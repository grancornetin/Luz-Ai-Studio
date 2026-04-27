// src/modules/ProductGeneratorModule.tsx
import React, { useState, useEffect } from 'react';
import ModuleTutorial from '../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../components/shared/tutorialConfigs';
import { useCreditGuard } from '../../hooks/useCreditGuard';
import NoCreditsModal from '../components/shared/NoCreditsModal';
import { CREDIT_COSTS, MODEL_CREDIT_COST } from '../services/creditConfig';
import { useNavigate } from 'react-router-dom';
import { ProductProfile } from '../types';
import { geminiService } from '../services/geminiService';
import { imageApiService, extractImageRef } from '../services/imageApiService';
import { PRODUCT_BASE_STYLES_SEEDREAM } from '../constants';
import { ModelSelector } from '../components/shared/ModelSelector';
import { GenerateButton } from '../components/shared/GenerateButton';
import { useModelSelection } from '../hooks/useModelSelection';
import { useAuth } from '../modules/auth/AuthContext';
import { generationHistoryService } from '../services/generationHistoryService';
import { readAndCompressFile, downloadAsZip } from '../utils/imageUtils';
import { 
  PRODUCT_HARD_RULES, 
  PRODUCT_NEGATIVE_PROMPT, 
  PRODUCT_BASE_STYLES, 
  PRODUCT_SHOT_INTENTS, 
  ORGANIC_PROPS_BY_CATEGORY 
} from '../constants';

// Nuevos componentes base
import { ImageSlot } from '../components/shared/ImageSlot';
import UploadDisclaimer from '../components/shared/UploadDisclaimer';
import { ImageLightbox } from '../components/shared/ImageLightbox';
import { FloatingActionBar } from '../components/shared/FloatingActionBar';
import { useScrollFAB } from '../hooks/useScrollFAB';

interface ProductPhotographyProps {
  saveProduct: (product: ProductProfile) => void;
  products: ProductProfile[];
  standalone?: boolean;
}

type ProductWorkflowStep = 
  | 'setup' 
  | 'analyzing' 
  | 'generating_hero' 
  | 'checkpoint_hero' 
  | 'generating_remaining' 
  | 'completed_session';

const MAX_HERO_ATTEMPTS = 3;

// Helper to sanitize product anchor descriptions
const sanitizeProductAnchor = (prompt: string, productCategory: string): string => {
  let sanitized = prompt;
  const phrasesToRemove = [
    /held\s+(?:in|by)\s+(?:a\s+)?(?:person's|human's|model's|mannequin's|pair\s+of)?\s+(?:hand|fingers|foot|feet|body|arm|leg|head)/gi,
    /on\s+(?:a\s+)?(?:table|surface|background|stand|display|desk|floor|wall|shelf|fabric|cloth)/gi,
    /with\s+(?:a\s+)?(?:person|human|model|mannequin|hand|foot|body|shadow|reflection)/gi,
    /next\s+to\s+(?:a\s+)?(?:person|human|model|mannequin|hand|foot|body)/gi,
    /worn\s+by\s+(?:a\s+)?(?:person|human|model|mannequin)/gi,
    /in\s+the\s+background/gi,
    /on\s+the\s+ground/gi,
    /standing\s+(?:on|in)/gi,
    /floating\s+(?:in|on)/gi,
  ];

  phrasesToRemove.forEach(phrase => {
    sanitized = sanitized.replace(phrase, '');
  });

  sanitized = sanitized.replace(/\s\s+/g, ' ').trim();
  sanitized = sanitized.replace(/,\s*,/g, ',').trim();
  if (sanitized.endsWith(',')) {
    sanitized = sanitized.slice(0, -1).trim();
  }

  return sanitized;
};

const ProductPhotography: React.FC<ProductPhotographyProps> = ({ saveProduct, products, standalone }) => {
  const navigate = useNavigate();
  const { modelId, setModelId } = useModelSelection();
  const { credits } = useAuth(); // para saber créditos actuales
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');
  const [currentStep, setCurrentStep] = useState<ProductWorkflowStep>('setup');
  const [name, setName] = useState('');
  const [userDescription, setUserDescription] = useState('');
  const [category, setCategory] = useState<'clothing' | 'jewelry' | 'electronics' | 'other'>('clothing');
  const [style, setStyle] = useState<'comercial' | 'organico'>('comercial');
  const [files, setFiles] = useState<(string | null)[]>([null, null, null, null]); // 4 slots
  const [processingStatus, setProcessingStatus] = useState('');
  const [generatedShots, setGeneratedShots] = useState<string[]>([]);
  const [analyzedData, setAnalyzedData] = useState<any>(null);
  const [productAnchor, setProductAnchor] = useState('');

  const [heroApproved, setHeroApproved] = useState(false);
  const [heroAttempts, setHeroAttempts] = useState(0);

  const [selectedProduct, setSelectedProduct] = useState<ProductProfile | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxMetadata, setLightboxMetadata] = useState<{ label: string }>({ label: '' });

  // FAB scroll detection
  const { isVisible: fabVisible } = useScrollFAB({ threshold: 100, alwaysVisibleOnMobile: false });

  const { checkAndDeduct, showNoCredits, requiredCredits, closeModal } = useCreditGuard();

  // Onboarding: carga imagen gratuita desde localStorage si viene del wizard
  useEffect(() => {
    const img = localStorage.getItem('onboarding_image_product');
    const free = localStorage.getItem('onboarding_free_generation');
    if (img && free) {
      localStorage.removeItem('onboarding_image_product');
      localStorage.removeItem('onboarding_free_generation');
      setFiles([img, null, null, null]);
      setName('Mi primer producto');
      startGeneratingHero(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handlers para los 4 slots de imagen
  const updateFile = (index: number, base64: string | null) => {
    const newFiles = [...files];
    newFiles[index] = base64;
    setFiles(newFiles);
  };

  const handleDownloadIndividual = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadZip = async (productToZip: ProductProfile | null = null) => {
    const targetProduct = productToZip || (currentStep === 'completed_session' && analyzedData ? { name, generatedImages: generatedShots } : null);
    if (!targetProduct || targetProduct.generatedImages.length === 0) return;

    setIsZipping(true);
    try {
      const imagesToZip = targetProduct.generatedImages;
      const zipName = `Set_${targetProduct.name.replace(/\s+/g, '_')}.zip`;
      const prefix = targetProduct.name.replace(/\s+/g, '_');
      await downloadAsZip(imagesToZip, zipName, prefix);
    } catch (e) {
      alert("Error al comprimir el set.");
    } finally {
      setIsZipping(false);
    }
  };

  const getShotIntent = (shotNum: number, currentCategory: string, currentStyle: 'comercial' | 'organico') => {
    if (currentStyle === 'organico' && shotNum === 5) {
      const intentFn = PRODUCT_SHOT_INTENTS.organico[5] as (category: string) => string;
      return intentFn(currentCategory);
    }
    return (PRODUCT_SHOT_INTENTS as any)[currentStyle][shotNum];
  };

  const generateImageWithAllRules = async (intent: string, refs: string[]) => {
    const styles = modelId === 'seedream' ? PRODUCT_BASE_STYLES_SEEDREAM : PRODUCT_BASE_STYLES;
    const baseStylePrompt = styles[style];
    const finalPrompt = `${baseStylePrompt}\n${intent}\n${PRODUCT_HARD_RULES}\nPRODUCT ANCHOR: ${productAnchor}`;

    const refObjects = refs.map((img, i) => {
      try { return extractImageRef(img, `productRef[${i}]`); } catch { return null; }
    }).filter(Boolean) as Array<{ data: string; mimeType: string }>;

    return imageApiService.generateImage({
      prompt:          finalPrompt,
      negative:        PRODUCT_NEGATIVE_PROMPT,
      referenceImages: refObjects.length > 0 ? refObjects : undefined,
      aspectRatio:     '3:4',
      module:          'ProductGeneratorModule',
      modelId,
    });
  };

  const MIN_PHOTOS = 2;

  const startGeneratingHero = async (free = false) => {
    const validFiles = files.filter(f => f !== null) as string[];
    if (!name) {
      alert("Por favor, especifica el nombre del producto.");
      return;
    }
    if (!free && validFiles.length < MIN_PHOTOS) {
      alert(`Sube al menos ${MIN_PHOTOS} fotos del producto (ej: frontal y trasera) para que la IA comprenda todas sus caras.`);
      return;
    }
    if (!free) {
      const ok = await checkAndDeduct(CREDIT_COSTS.PRODUCT_GENERATION);
      if (!ok) return;
    }

    setCurrentStep('analyzing');
    setProcessingStatus('Escaneando materiales y contexto del producto...');
    setGeneratedShots([]);
    setHeroApproved(false);

    try {
      const analysis = await geminiService.analyzeProduct(validFiles, userDescription);
      setAnalyzedData(analysis);
      setProductAnchor(sanitizeProductAnchor(analysis.product_prompt, category));
      
      setCurrentStep('generating_hero');
      setProcessingStatus('Generando Imagen Hero (1/5)...');
      
      const heroIntent = getShotIntent(1, category, style);
      const heroImage = await generateImageWithAllRules(heroIntent, validFiles);
      
      setGeneratedShots([heroImage]);
      
      generationHistoryService.save({
        imageUrl: heroImage,
        module: 'catalog',
        moduleLabel: 'Product Studio (Hero)',
        creditsUsed: free ? 0 : CREDIT_COSTS.PRODUCT_GENERATION,
        promptText: heroIntent
      }).catch(console.error);

      setHeroAttempts(0);
      setCurrentStep('checkpoint_hero');

    } catch (e: any) {
      alert("Error en la fase de análisis o generación inicial: " + e.message);
      setCurrentStep('setup');
      setProcessingStatus('');
    }
  };

  const regenerateHero = async () => {
    const validFiles = files.filter(f => f !== null) as string[];
    if (!analyzedData || heroAttempts >= MAX_HERO_ATTEMPTS) {
      alert("Demasiados intentos. Por favor, reinicia o prueba con otras fotos.");
      return;
    }

    setHeroAttempts(prev => prev + 1);
    setCurrentStep('generating_hero');
    setProcessingStatus(`Regenerando Imagen Hero (Intento ${heroAttempts + 1}/${MAX_HERO_ATTEMPTS})...`);

    try {
      const heroIntent = getShotIntent(1, category, style);
      const heroImage = await generateImageWithAllRules(heroIntent, validFiles);
      
      setGeneratedShots([heroImage]);
      setCurrentStep('checkpoint_hero');
    } catch (e: any) {
      alert("Error al regenerar Imagen Hero: " + e.message);
      if (heroAttempts + 1 >= MAX_HERO_ATTEMPTS) {
        alert("No se pudo generar con suficiente fidelidad. Prueba con otra foto más clara del producto o con un ángulo más frontal.");
        resetCreator();
        setCurrentStep('setup');
      } else {
        setCurrentStep('checkpoint_hero');
      }
    }
  };

  const generateRemainingShots = async () => {
    const validFiles = files.filter(f => f !== null) as string[];
    if (!generatedShots[0] || !analyzedData) return;
    const ok = await checkAndDeduct(CREDIT_COSTS.PRODUCT_GENERATION * 4);
    if (!ok) return;
    setHeroApproved(true);
    setCurrentStep('generating_remaining');
    setProcessingStatus('Generando el resto del set (2-5)...');

    const shotsProgress = [...generatedShots];

    await Promise.allSettled(
      [2, 3, 4, 5].map(async (i) => {
        const intent = getShotIntent(i, category, style);
        try {
          const img = await generateImageWithAllRules(intent, validFiles);
          shotsProgress[i - 1] = img;
          setGeneratedShots([...shotsProgress]);

          generationHistoryService.save({
            imageUrl:    img,
            module:      'catalog',
            moduleLabel: `Product Studio (Shot ${i})`,
            creditsUsed: CREDIT_COSTS.PRODUCT_GENERATION,
            promptText:  intent,
          }).catch(console.error);
        } catch (e: any) {
          console.error(`Error generating shot ${i}:`, e);
          shotsProgress[i - 1] = 'error';
          setGeneratedShots([...shotsProgress]);
        }
      })
    );

    setCurrentStep('completed_session');
    setProcessingStatus('Producción completada.');
  };

  const handleSaveToCatalog = () => {
    if (!analyzedData || generatedShots.length < 5) return;
    
    const validFiles = files.filter(f => f !== null) as string[];
    const newProduct: ProductProfile = {
      id: Date.now().toString(),
      name,
      category,
      baseImages: validFiles,
      generatedImages: generatedShots,
      productPrompt: productAnchor,
      technicalDescription: analyzedData.technical_description,
      commercialDescription: analyzedData.commercial_description,
      metadata: {
        material: analyzedData.metadata.material,
        color: analyzedData.metadata.color,
        style: style
      },
      createdAt: Date.now()
    };

    saveProduct(newProduct);
    alert("Producto archivado en el catálogo exitosamente.");
    resetCreator();
    setActiveTab('library');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetCreator = () => {
    setName('');
    setUserDescription('');
    setCategory('clothing');
    setStyle('comercial');
    setFiles([null, null, null, null]);
    setGeneratedShots([]);
    setAnalyzedData(null);
    setProductAnchor('');
    setCurrentStep('setup');
    setProcessingStatus('');
    setHeroApproved(false);
    setHeroAttempts(0);
    setSelectedProduct(null);
  };

  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(message);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      alert('Error al copiar al portapapeles.');
    });
  };

  const openLightbox = (images: string[], initialIndex: number, label: string) => {
    setLightboxImages(images);
    setLightboxIndex(initialIndex);
    setLightboxMetadata({ label });
    setLightboxOpen(true);
  };

  const openProductDetail = (product: ProductProfile) => {
    setSelectedProduct(product);
    openLightbox(product.generatedImages, 0, product.name);
  };

  const isGenerating = currentStep === 'analyzing' || currentStep === 'generating_hero' || currentStep === 'generating_remaining';
  const hasTooManyHeroAttempts = heroAttempts >= MAX_HERO_ATTEMPTS;

  // Calcular créditos restantes después de generar el set de 5 imágenes
  const creditCostPerImage = MODEL_CREDIT_COST[modelId];
  const totalCost = 5 * creditCostPerImage;
  const creditsAfter = Math.max(0, credits.available - totalCost);

  return (
    <>
      <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={0} />
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 pb-20 animate-in fade-in duration-500">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
          <div>
            <h1 className="t-display text-3xl text-slate-900">Product Studio Pro</h1>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-slate-500 font-medium italic text-xs md:text-sm">Fotografía de alta gama.</p>
              <ModuleTutorial moduleId="catalog" steps={TUTORIAL_CONFIGS.catalog} />
            </div>
          </div>
          <div className={`flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100 transition-all ${isGenerating ? 'opacity-50 pointer-events-none' : ''}`}>
            <button onClick={() => { setActiveTab('create'); window.scrollTo(0,0); resetCreator(); }} className={`px-5 md:px-8 py-2 md:py-3 rounded-xl t-meta transition-all ${activeTab === 'create' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700'}`}>Laboratorio</button>
            <button onClick={() => { setActiveTab('library'); window.scrollTo(0,0); resetCreator(); }} className={`px-5 md:px-8 py-2 md:py-3 rounded-xl t-meta transition-all ${activeTab === 'library' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700'}`}>Catálogo ({products.length})</button>
          </div>
        </header>

        {activeTab === 'create' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-6">
              <div className={`bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-sm border border-slate-100 space-y-8 transition-all ${isGenerating ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="space-y-6">
                  <div>
                    <label className="t-meta block mb-2">Nombre del Artículo</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Reloj Chrono Gold v2" autoComplete="off" autoCapitalize="words" className="w-full px-5 py-3 md:px-6 md:py-4 rounded-2xl border bg-slate-50 font-bold text-slate-800 outline-none focus:bg-white transition-all text-base md:text-sm" />
                  </div>

                  <div>
                    <label className="t-meta block mb-2">Describe tu producto (Opcional)</label>
                    <textarea value={userDescription} onChange={e => setUserDescription(e.target.value)} placeholder="Ej: Reloj de acero inoxidable con esfera azul y correa de cuero negro." autoComplete="off" autoCapitalize="sentences" className="w-full p-4 rounded-2xl border bg-slate-50 text-base md:text-xs min-h-[80px] font-bold text-slate-800 outline-none focus:bg-white transition-all"></textarea>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="t-meta block mb-2">Categoría</label>
                      <select value={category} onChange={e => setCategory(e.target.value as any)} className="w-full p-3 md:p-4 rounded-xl border bg-slate-50 text-base md:text-xs font-bold text-slate-900 outline-none">
                        <option value="clothing">Ropa / Textil</option>
                        <option value="jewelry">Joyería / Accesorios</option>
                        <option value="electronics">Electrónica</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="t-meta block mb-2">Estilo de Producción</label>
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setStyle('comercial')} className={`flex-1 py-2 t-meta rounded-lg transition-all ${style === 'comercial' ? 'bg-white shadow-sm text-brand-600 border border-brand-50' : 'text-slate-400'}`}>Comercial</button>
                        <button onClick={() => setStyle('organico')} className={`flex-1 py-2 t-meta rounded-lg transition-all ${style === 'organico' ? 'bg-white shadow-sm text-brand-600 border border-brand-50' : 'text-slate-400'}`}>Orgánico</button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Fotos del producto <span className="text-brand-600">*mín. 2</span>
                      </label>
                      <span className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${files.filter(f=>f).length >= MIN_PHOTOS ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {files.filter(f=>f).length}/4 subidas
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 md:gap-3">
                      {[
                        { label: 'Frontal', hint: 'Vista delantera' },
                        { label: 'Trasera', hint: 'Vista trasera' },
                        { label: 'Lateral', hint: 'Vista lateral' },
                        { label: 'Superior', hint: 'Vista superior' },
                      ].map((slot, idx) => (
                        <ImageSlot
                          key={idx}
                          value={files[idx]}
                          onChange={(base64) => updateFile(idx, base64)}
                          label={slot.label}
                          hint={slot.hint}
                          aspectRatio="square"
                          disabled={isGenerating}
                          iconless
                        />
                      ))}
                    </div>
                    <p className="text-[9px] font-medium text-slate-400 mt-2 leading-relaxed">
                      Sube al menos frontal y trasera para que la IA conozca todas las caras del producto. Más vistas = mejor resultado.
                    </p>
                  </div>

                  <UploadDisclaimer />

                  <ModelSelector value={modelId} onChange={setModelId} disabled={isGenerating} />

                  <GenerateButton
                    onClick={startGeneratingHero}
                    loading={isGenerating}
                    disabled={files.filter(f => f !== null).length < MIN_PHOTOS || !name}
                    label="Generar Set de 5 Fotos"
                    loadingLabel={processingStatus || 'Generando...'}
                    imageCount={5}
                    creditsAfter={creditsAfter}
                    className="py-4 md:py-5 rounded-2xl md:rounded-[24px]"
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="bg-slate-900 rounded-[40px] md:rounded-[56px] p-6 md:p-10 min-h-[500px] md:min-h-[750px] flex flex-col shadow-2xl relative overflow-hidden">
                {(currentStep === 'setup' || currentStep === 'analyzing') && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 md:space-y-10 p-4">
                     <div className="w-40 h-40 md:w-56 md:h-56 bg-white/5 rounded-full flex items-center justify-center text-6xl md:text-8xl text-white/10 border border-white/10 shadow-inner">
                        <i className={`fa-solid fa-gem ${currentStep === 'analyzing' ? 'animate-pulse' : ''}`}></i>
                     </div>
                     <h3 className="t-display text-2xl md:text-3xl text-white max-w-sm mx-auto">Motor de Catálogo Pro</h3>
                     {currentStep === 'analyzing' && <p className="t-meta text-brand-400 animate-pulse">{processingStatus}</p>}
                  </div>
                )}

                {(currentStep === 'generating_hero' || currentStep === 'generating_remaining') && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 md:space-y-10 p-4">
                    <div className="w-16 h-16 border-4 border-white/5 border-t-brand-500 rounded-full animate-spin"></div>
                    <p className="t-meta text-brand-400 animate-pulse">{processingStatus}</p>
                  </div>
                )}

                {currentStep === 'checkpoint_hero' && generatedShots.length > 0 && (
                  <div className="flex-1 flex flex-col space-y-8 animate-in fade-in">
                    <header className="flex justify-between items-center border-b border-white/10 pb-6">
                      <div>
                        <h3 className="t-display text-2xl text-white">Checkpoint: Imagen Hero</h3>
                        <p className="t-meta text-brand-400 mt-1">Validación de Fidelidad 1:1</p>
                      </div>
                    </header>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                      <div className="md:col-span-7 flex flex-col items-center justify-center">
                        <div className="w-full space-y-6">
                          <div 
                            className="aspect-[3/4] bg-slate-800 rounded-[40px] overflow-hidden shadow-2xl border-4 border-white/10 relative group cursor-pointer"
                            onClick={() => openLightbox([generatedShots[0]], 0, 'Imagen Hero')}
                          >
                            <img src={generatedShots[0]} className="w-full h-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/90 to-transparent text-center">
                              <p className="t-meta text-white">INSPECCIÓN: IMAGEN MAESTRA (HERO)</p>
                            </div>
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <i className="fa-solid fa-expand text-white text-3xl"></i>
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <button 
                              onClick={regenerateHero} 
                              disabled={isGenerating || hasTooManyHeroAttempts}
                              className={`flex-1 py-5 bg-white/5 text-white rounded-3xl t-meta border border-white/10 hover:bg-white/10 transition-all ${hasTooManyHeroAttempts ? 'opacity-30 cursor-not-allowed' : ''}`}
                            >
                              {isGenerating ? 'Generando...' : (hasTooManyHeroAttempts ? 'Límite de Reintentos' : `Regenerar ( ${heroAttempts}/${MAX_HERO_ATTEMPTS-1} )`)}
                            </button>
                            <button 
                              onClick={generateRemainingShots} 
                              disabled={isGenerating}
                              className={`flex-1 py-5 rounded-3xl t-meta shadow-2xl transition-all ${isGenerating ? 'bg-slate-700 text-slate-500' : 'bg-brand-500 text-white hover:bg-brand-400'}`}
                            >
                              Aprobar y Continuar
                            </button>
                          </div>
                          {hasTooManyHeroAttempts && (
                            <p className="text-red-400 text-xs text-center italic mt-2">
                              No se pudo generar con suficiente fidelidad. Prueba con otra foto más clara del producto o con un ángulo más frontal.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="md:col-span-5 bg-white/5 rounded-[40px] border border-white/10 p-6 space-y-6 text-white">
                        <h4 className="t-meta text-brand-400 border-b border-white/10 pb-4">Guía de Aprobación</h4>
                        <p className="text-xs font-bold leading-relaxed">
                          <i className="fa-solid fa-circle-check text-brand-400 mr-2"></i>
                          Verifica que la imagen 1 muestre SOLO el producto correcto.
                        </p>
                        <p className="text-xs font-bold leading-relaxed">
                          <i className="fa-solid fa-circle-xmark text-red-400 mr-2"></i>
                          Asegúrate de que NO haya manos, cuerpos, reflejos humanos, ni deforma-ciones.
                        </p>
                        <p className="text-xs font-bold leading-relaxed">
                          <i className="fa-solid fa-question-circle text-brand-400 mr-2"></i>
                          Si la imagen no es perfecta, puedes regenerarla.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 'completed_session' && generatedShots.length > 0 && (
                  <div className="space-y-6 md:space-y-8 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 pb-6 md:pb-8 gap-4">
                      <div>
                        <h3 className="t-display text-xl md:text-2xl text-white">{name}</h3>
                        <span className="t-meta text-brand-400">{processingStatus}</span>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => handleDownloadZip(null)} disabled={isZipping} className="flex-1 sm:flex-none px-4 md:px-6 py-3 md:py-4 bg-white/10 text-white rounded-xl md:rounded-2xl t-meta flex items-center justify-center gap-2 hover:bg-white/20 transition-all border border-white/5">
                          {isZipping ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-file-zipper"></i>}
                          zip completo
                        </button>
                        <button onClick={handleSaveToCatalog} className="flex-1 sm:flex-none px-6 md:px-8 py-3 md:py-4 bg-brand-500 text-white rounded-xl md:rounded-2xl t-meta shadow-lg hover:bg-brand-600 transition-all active:scale-95">
                          guardar en catálogo
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:gap-6">
                      {generatedShots.map((p, i) => (
                        <div 
                          key={i} 
                          className={`group relative aspect-[3/4] rounded-[24px] md:rounded-[32px] overflow-hidden bg-white shadow-2xl cursor-pointer ${i === 0 ? 'col-span-2 aspect-[16/9]' : ''}`}
                          onClick={() => openLightbox(generatedShots, i, `${name} - Shot ${i+1}`)}
                        >
                          <img src={p} className="w-full h-full object-cover" />
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDownloadIndividual(p, `${name.replace(/\s+/g, '_')}_shot_${i+1}.png`); }} 
                            className="absolute bottom-4 right-4 md:bottom-8 md:right-8 w-10 h-10 md:w-12 md:h-12 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-xl md:opacity-0 md:group-hover:opacity-100 transition-all hover:scale-110"
                          >
                            <i className="fa-solid fa-download"></i>
                          </button>
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                            <i className="fa-solid fa-expand text-white text-2xl"></i>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 px-1">
            {products.map(product => (
              <div 
                key={product.id} 
                className="bg-white p-5 md:p-6 rounded-[40px] md:rounded-[56px] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group overflow-hidden cursor-pointer" 
                onClick={() => openProductDetail(product)}
              >
                <div className="aspect-square rounded-[32px] md:rounded-[44px] overflow-hidden bg-slate-50 mb-6 md:mb-8 relative shadow-inner">
                  <img src={product.generatedImages[0] || product.baseImages[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="px-1 md:px-2 space-y-3 md:space-y-4">
                  <h4 className="t-display text-xl md:text-2xl text-slate-900 truncate">{product.name}</h4>
                  <div className="flex gap-2">
                    <span className="px-3 py-1.5 bg-slate-50 text-xs font-black text-slate-500 uppercase rounded-xl border border-slate-100">{product.metadata.material}</span>
                    <span className="px-3 py-1.5 bg-slate-50 text-xs font-black text-slate-500 uppercase rounded-xl border border-slate-100">{product.category}</span>
                  </div>
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <div className="col-span-full py-20 md:py-32 text-center bg-white rounded-[40px] md:rounded-[56px] border-2 border-dashed border-slate-200">
                <i className="fa-solid fa-box-open text-5xl md:text-6xl text-slate-100 mb-6"></i>
                <p className="text-slate-400 font-black uppercase text-xs md:text-sm tracking-[0.2em]">Catálogo vacío</p>
              </div>
            )}
          </div>
        )}

        {/* LIGHTBOX UNIVERSAL */}
        {lightboxOpen && lightboxImages.length > 0 && (
          <ImageLightbox
            images={lightboxImages}
            initialIndex={lightboxIndex}
            onClose={() => {
              setLightboxOpen(false);
              setSelectedProduct(null);
            }}
            onDownload={(url, idx) => {
              const link = document.createElement('a');
              link.href = url;
              link.download = `product_image_${idx + 1}.png`;
              link.click();
            }}
            metadata={lightboxMetadata}
          />
        )}

        {/* FLOATING ACTION BAR */}
        {currentStep === 'completed_session' && generatedShots.length > 0 && fabVisible && (
          <FloatingActionBar
            isVisible={true}
            primaryAction={{
              label: isZipping ? 'Comprimiendo...' : 'Descargar ZIP',
              icon: isZipping ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-file-zipper text-sm"></i>,
              onClick: () => handleDownloadZip(null),
              loading: isZipping,
            }}
            onClearSelection={resetCreator}
            selectedCount={0}
          />
        )}
      </div>
    </>
  );
};

export default ProductPhotography;