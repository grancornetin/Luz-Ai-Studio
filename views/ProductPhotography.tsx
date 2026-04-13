

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductProfile } from '../types';
import { geminiService } from '../services/geminiService';
import { 
  PRODUCT_HARD_RULES, 
  PRODUCT_NEGATIVE_PROMPT, 
  PRODUCT_BASE_STYLES, 
  PRODUCT_SHOT_INTENTS, 
  ORGANIC_PROPS_BY_CATEGORY 
} from '../src/constants';
import JSZip from 'jszip';

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
  // Common phrases referring to human interaction or background elements to remove
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

  // Clean up extra spaces and punctuation
  sanitized = sanitized.replace(/\s\s+/g, ' ').trim();
  sanitized = sanitized.replace(/,\s*,/g, ',').trim(); // Remove double commas
  if (sanitized.endsWith(',')) {
    sanitized = sanitized.slice(0, -1).trim(); // Remove trailing comma
  }

  // Add specific prop hint for organic style, if applicable, without making it part of the core product ID
  // This is handled by the shot intent directly now.

  return sanitized;
};


const ProductPhotography: React.FC<ProductPhotographyProps> = ({ saveProduct, products, standalone }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');
  const [currentStep, setCurrentStep] = useState<ProductWorkflowStep>('setup');
  const [name, setName] = useState('');
  const [userDescription, setUserDescription] = useState('');
  const [category, setCategory] = useState<'clothing' | 'jewelry' | 'electronics' | 'other'>('clothing');
  const [style, setStyle] = useState<'comercial' | 'organico'>('comercial');
  const [files, setFiles] = useState<string[]>([]); // Base images for product
  const [processingStatus, setProcessingStatus] = useState('');
  const [generatedShots, setGeneratedShots] = useState<string[]>([]); // Holds all 5 generated images
  const [analyzedData, setAnalyzedData] = useState<any>(null);
  const [productAnchor, setProductAnchor] = useState('');

  const [heroApproved, setHeroApproved] = useState(false);
  const [heroAttempts, setHeroAttempts] = useState(0);

  const [selectedProduct, setSelectedProduct] = useState<ProductProfile | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => setFiles(prev => [...prev, reader.result as string].slice(0, 4));
        reader.readAsDataURL(file);
      });
    }
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

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
      const zip = new JSZip();
      const folderName = `${targetProduct.name.replace(/\s+/g, '_')}_set`;
      const folder = zip.folder(folderName);
      
      targetProduct.generatedImages.forEach((p, i) => {
        const base64 = p.split(',')[1];
        folder?.file(`shot_${i + 1}.png`, base64, { base64: true });
      });

      if (productToZip && productToZip.technicalDescription && productToZip.commercialDescription) {
        folder?.file("ficha_tecnica.txt", productToZip.technicalDescription);
        folder?.file("copy_comercial.txt", productToZip.commercialDescription);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Set_${targetProduct.name.replace(/\s+/g, '_')}.zip`;
      link.click();
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
    const baseStylePrompt = PRODUCT_BASE_STYLES[style];
    const finalPrompt = `${baseStylePrompt}\n${intent}\n${PRODUCT_HARD_RULES}\nPRODUCT ANCHOR: ${productAnchor}`;
    
    return geminiService.generateImage(
      finalPrompt,
      PRODUCT_NEGATIVE_PROMPT,
      true, // usePro
      '1K',
      refs
    );
  };

  const startGeneratingHero = async () => {
    if (!name || files.length === 0) {
      alert("Por favor, especifica un nombre y adjunta fotos reales.");
      return;
    }

    setCurrentStep('analyzing');
    setProcessingStatus('Escaneando materiales y contexto del producto...');
    setGeneratedShots([]);
    setHeroApproved(false);

    try {
      const analysis = await geminiService.analyzeProduct(files, userDescription);
      setAnalyzedData(analysis);
      setProductAnchor(sanitizeProductAnchor(analysis.product_prompt, category));
      
      setCurrentStep('generating_hero');
      setProcessingStatus('Generando Imagen Hero (1/5)...');
      
      const heroIntent = getShotIntent(1, category, style);
      const heroImage = await generateImageWithAllRules(heroIntent, files);
      
      setGeneratedShots([heroImage]);
      setHeroAttempts(0);
      setCurrentStep('checkpoint_hero');

    } catch (e: any) {
      alert("Error en la fase de análisis o generación inicial: " + e.message);
      setCurrentStep('setup');
      setProcessingStatus('');
    }
  };

  const regenerateHero = async () => {
    if (!analyzedData || heroAttempts >= MAX_HERO_ATTEMPTS) {
      alert("Demasiados intentos. Por favor, reinicia o prueba con otras fotos.");
      return;
    }

    setHeroAttempts(prev => prev + 1);
    setCurrentStep('generating_hero');
    setProcessingStatus(`Regenerando Imagen Hero (Intento ${heroAttempts + 1}/${MAX_HERO_ATTEMPTS})...`);

    try {
      const heroIntent = getShotIntent(1, category, style);
      const heroImage = await generateImageWithAllRules(heroIntent, files);
      
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
    if (!generatedShots[0] || !analyzedData) return;
    setHeroApproved(true);
    setCurrentStep('generating_remaining');
    setProcessingStatus('Generando el resto del set (2-5)...');

    const shotsProgress = [...generatedShots]; // Start with the approved hero image
    
    for (let i = 2; i <= 5; i++) {
      setProcessingStatus(`Renderizando ángulo ${i}/5...`);
      try {
        const intent = getShotIntent(i, category, style);
        const img = await generateImageWithAllRules(intent, files);
        shotsProgress.push(img);
        setGeneratedShots([...shotsProgress]); // Update state to show progress
      } catch (e: any) {
        console.error(`Error generating shot ${i}:`, e);
        shotsProgress.push('error'); // Mark as error or a placeholder
        setGeneratedShots([...shotsProgress]);
      }
      await new Promise(resolve => setTimeout(resolve, 1500)); // Small delay to prevent API exhaustion
    }
    setCurrentStep('completed_session');
    setProcessingStatus('Producción completada.');
  };

  const handleSaveToCatalog = () => {
    if (!analyzedData || generatedShots.length < 5) return;
    
    const newProduct: ProductProfile = {
      id: Date.now().toString(),
      name,
      category,
      baseImages: files, // Original user-uploaded images
      generatedImages: generatedShots, // AI generated images (all 5)
      productPrompt: productAnchor, // Sanitized product description
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
    setFiles([]);
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

  const isGenerating = currentStep === 'analyzing' || currentStep === 'generating_hero' || currentStep === 'generating_remaining';
  const hasTooManyHeroAttempts = heroAttempts >= MAX_HERO_ATTEMPTS;

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 pb-20 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Product Studio Pro</h1>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-slate-500 font-medium italic text-xs md:text-sm">Fotografía de alta gama.</p>
            <button 
              onClick={() => setShowGuide(!showGuide)}
              className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 transition-all"
            >
              <i className={`fa-solid ${showGuide ? 'fa-circle-minus' : 'fa-circle-question'}`}></i>
              {showGuide ? 'Cerrar Guía' : '¿Cómo funciona?'}
            </button>
          </div>
        </div>
        <div className={`flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100 transition-all ${isGenerating ? 'opacity-50 pointer-events-none' : ''}`}>
          <button onClick={() => { setActiveTab('create'); window.scrollTo(0,0); resetCreator(); }} className={`px-5 md:px-8 py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'create' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700'}`}>Laboratorio</button>
          <button onClick={() => { setActiveTab('library'); window.scrollTo(0,0); resetCreator(); }} className={`px-5 md:px-8 py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'library' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700'}`}>Catálogo ({products.length})</button>
        </div>
      </header>

      {showGuide && (
        <section className="bg-white p-6 md:p-8 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-4">🧩 MÓDULO 2 · CATÁLOGO</h3>
          <p className="text-slate-600 text-xs md:text-sm leading-relaxed">
            <strong>Convierte fotos simples de tus productos en imágenes profesionales de catálogo.</strong><br />
            Este módulo está diseñado exclusivamente para productos, permitiéndote generar imágenes limpias, ordenadas y listas para e-commerce o catálogos digitales.
            <br /><br />
            Solo debes subir una fotografía donde el producto sea claramente visible y elegir el estilo visual: estudio fotográfico o fotografía más orgánica.
            La app generará automáticamente un set de cinco tomas diferentes del producto, manteniendo coherencia visual y acabado profesional.
            <br /><br />
            Ideal para marcas, tiendas online y presentaciones comerciales.
          </p>
        </section>
      )}

      {activeTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-6">
            <div className={`bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-sm border border-slate-100 space-y-8 transition-all ${isGenerating ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre del Artículo</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Reloj Chrono Gold v2" className="w-full px-5 py-3 md:px-6 md:py-4 rounded-2xl border bg-slate-50 font-bold text-slate-800 outline-none focus:bg-white transition-all text-sm" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Describe tu producto (Opcional)</label>
                  <textarea value={userDescription} onChange={e => setUserDescription(e.target.value)} placeholder="Ej: Reloj de acero inoxidable con esfera azul y correa de cuero negro." className="w-full p-4 rounded-2xl border bg-slate-50 text-xs min-h-[80px] font-bold text-slate-800 outline-none focus:bg-white transition-all"></textarea>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Categoría</label>
                    <select value={category} onChange={e => setCategory(e.target.value as any)} className="w-full p-3 md:p-4 rounded-xl border bg-slate-50 text-[10px] md:text-xs font-bold text-slate-900 outline-none">
                      <option value="clothing">Ropa / Textil</option>
                      <option value="jewelry">Joyería / Accesorios</option>
                      <option value="electronics">Electrónica</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Estilo de Producción</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => setStyle('comercial')} className={`flex-1 py-2 text-[8px] md:text-[9px] font-black uppercase rounded-lg transition-all ${style === 'comercial' ? 'bg-white shadow-sm text-emerald-600 border border-emerald-50' : 'text-slate-400'}`}>Comercial</button>
                      <button onClick={() => setStyle('organico')} className={`flex-1 py-2 text-[8px] md:text-[9px] font-black uppercase rounded-lg transition-all ${style === 'organico' ? 'bg-white shadow-sm text-emerald-600 border border-emerald-50' : 'text-slate-400'}`}>Orgánico</button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fotos de Referencia (Máx 4)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                    {files.map((f, i) => (
                      <div key={i} className="aspect-square relative rounded-xl overflow-hidden border border-slate-200 group">
                        <img src={f} className="w-full h-full object-cover" />
                        <button onClick={() => removeFile(i)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-lg"><i className="fa-solid fa-trash"></i></button>
                      </div>
                    ))}
                    {files.length < 4 && (
                      <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all group">
                        <i className="fa-solid fa-camera text-slate-300 group-hover:scale-110 transition-transform text-xl"></i>
                        <input type="file" hidden multiple onChange={handleFileChange} />
                      </label>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                    <i className="fa-solid fa-scale-balanced mr-1"></i>
                    Disclaimer: El usuario es responsable total por los derechos, permisos y uso comercial del contenido subido.
                  </p>
                </div>

                <button onClick={startGeneratingHero} disabled={isGenerating || files.length === 0 || !name} className="w-full py-5 md:py-6 bg-emerald-600 text-white rounded-2xl md:rounded-[24px] font-black text-[10px] md:text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50">
                  {isGenerating ? processingStatus : 'Generar Set de 5 Fotos'}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-slate-900 rounded-[40px] md:rounded-[56px] p-6 md:p-10 min-h-[400px] md:min-h-[750px] flex flex-col shadow-2xl relative overflow-hidden border-4 md:border-8 border-slate-800">
              {(currentStep === 'setup' || currentStep === 'analyzing') && (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 md:space-y-10 p-4">
                   <div className="w-32 h-32 md:w-56 md:h-56 bg-white/5 rounded-full flex items-center justify-center text-5xl md:text-8xl text-white/10 border border-white/10 shadow-inner">
                      <i className={`fa-solid fa-gem ${currentStep === 'analyzing' ? 'animate-pulse' : ''}`}></i>
                   </div>
                   <h3 className="text-xl md:text-3xl font-black text-white uppercase italic tracking-tighter max-w-sm mx-auto">Motor de Catálogo Pro</h3>
                   {currentStep === 'analyzing' && <p className="text-emerald-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest animate-pulse">{processingStatus}</p>}
                </div>
              )}

              {(currentStep === 'generating_hero' || currentStep === 'generating_remaining') && (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 md:space-y-10 p-4">
                  <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-white/5 border-t-emerald-500 rounded-full animate-spin"></div>
                  <p className="text-emerald-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest animate-pulse">{processingStatus}</p>
                </div>
              )}

              {currentStep === 'checkpoint_hero' && generatedShots.length > 0 && (
                <div className="flex-1 flex flex-col space-y-8 animate-in fade-in">
                  <header className="flex justify-between items-center border-b border-white/10 pb-6">
                    <div>
                      <h3 className="text-white font-black text-xl md:text-2xl uppercase italic tracking-tighter">Checkpoint: Imagen Hero</h3>
                      <p className="text-emerald-400 text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] mt-1 italic">Validación de Fidelidad 1:1</p>
                    </div>
                  </header>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                    <div className="md:col-span-7 flex flex-col items-center justify-center">
                      <div className="w-full space-y-6">
                        <div className="aspect-[3/4] bg-slate-800 rounded-[30px] md:rounded-[40px] overflow-hidden shadow-2xl border-2 md:border-4 border-white/10 relative group">
                          <img src={generatedShots[0]} className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 bg-gradient-to-t from-black/90 to-transparent text-center">
                            <p className="text-white text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em]">INSPECCIÓN: IMAGEN MAESTRA (HERO)</p>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <button 
                            onClick={regenerateHero} 
                            disabled={isGenerating || hasTooManyHeroAttempts}
                            className={`flex-1 py-4 md:py-5 bg-white/5 text-white rounded-2xl md:rounded-3xl font-black text-[9px] md:text-[10px] uppercase border border-white/10 hover:bg-white/10 transition-all ${hasTooManyHeroAttempts ? 'opacity-30 cursor-not-allowed' : ''}`}
                          >
                            {isGenerating ? 'Generando...' : (hasTooManyHeroAttempts ? 'Límite' : `Regenerar ( ${heroAttempts}/${MAX_HERO_ATTEMPTS-1} )`)}
                          </button>
                          <button 
                            onClick={generateRemainingShots} 
                            disabled={isGenerating}
                            className={`flex-1 py-4 md:py-5 rounded-2xl md:rounded-3xl font-black text-[9px] md:text-[10px] uppercase shadow-2xl transition-all ${isGenerating ? 'bg-slate-700 text-slate-500' : 'bg-emerald-500 text-white hover:bg-emerald-400'}`}
                          >
                            Aprobar y Continuar
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="md:col-span-5 bg-white/5 rounded-[30px] md:rounded-[40px] border border-white/10 p-5 md:p-6 space-y-4 md:space-y-6 text-white">
                      <h4 className="text-[9px] md:text-[10px] font-black text-emerald-400 uppercase tracking-widest border-b border-white/10 pb-4">Guía de Aprobación</h4>
                      <p className="text-[10px] md:text-[11px] font-bold leading-relaxed">
                        <i className="fa-solid fa-circle-check text-emerald-400 mr-2"></i>
                        Verifica que la imagen 1 muestre SOLO el producto correcto.
                      </p>
                      <p className="text-[10px] md:text-[11px] font-bold leading-relaxed">
                        <i className="fa-solid fa-circle-xmark text-red-400 mr-2"></i>
                        Asegúrate de que NO haya manos, cuerpos, ni deformaciones.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 'completed_session' && generatedShots.length > 0 && (
                <div className="space-y-6 md:space-y-8 animate-in fade-in duration-1000">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 pb-6 md:pb-8 gap-4">
                    <div>
                      <h3 className="text-white font-black text-xl md:text-2xl uppercase italic tracking-tighter truncate max-w-[250px]">{name}</h3>
                      <span className="text-emerald-400 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em]">{processingStatus}</span>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={() => handleDownloadZip(null)} className="flex-1 sm:flex-none px-4 md:px-6 py-3 md:py-4 bg-white/10 text-white rounded-xl md:rounded-2xl text-[8px] md:text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-white/20 transition-all border border-white/5">
                        <i className="fa-solid fa-file-zipper"></i> zip
                      </button>
                      <button onClick={handleSaveToCatalog} className="flex-1 sm:flex-none px-6 md:px-8 py-3 md:py-4 bg-emerald-500 text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase shadow-lg hover:bg-emerald-600 transition-all active:scale-95">
                        guardar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                    {generatedShots.map((p, i) => (
                      <div key={i} className={`group relative aspect-[3/4] rounded-[24px] md:rounded-[32px] overflow-hidden bg-white shadow-2xl ${i === 0 ? 'sm:col-span-2 aspect-[16/9]' : ''}`}>
                        <img src={p} className="w-full h-full object-cover" />
                        <button onClick={() => handleDownloadIndividual(p, `${name.replace(/\s+/g, '_')}_shot_${i+1}.png`)} className="absolute bottom-4 right-4 md:bottom-8 md:right-8 w-10 h-10 md:w-12 md:h-12 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-xl md:opacity-0 md:group-hover:opacity-100 transition-all hover:scale-110">
                           <i className="fa-solid fa-download"></i>
                        </button>
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
            <div key={product.id} className="bg-white p-5 md:p-6 rounded-[30px] md:rounded-[56px] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group overflow-hidden cursor-pointer" onClick={() => setSelectedProduct(product)}>
               <div className="aspect-square rounded-[24px] md:rounded-[44px] overflow-hidden bg-slate-50 mb-4 md:mb-8 relative shadow-inner">
                  <img src={product.generatedImages[0] || product.baseImages[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
               </div>
               <div className="px-1 md:px-2 space-y-2 md:space-y-4">
                  <h4 className="text-lg md:text-2xl font-black text-slate-900 uppercase italic truncate tracking-tight">{product.name}</h4>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-slate-50 text-[7px] md:text-[9px] font-black text-slate-500 uppercase rounded-lg border border-slate-100">{product.metadata.material}</span>
                    <span className="px-3 py-1 bg-slate-50 text-[7px] md:text-[9px] font-black text-slate-500 uppercase rounded-lg border border-slate-100">{product.category}</span>
                  </div>
               </div>
            </div>
          ))}
          {products.length === 0 && (
            <div className="col-span-full py-20 md:py-32 text-center bg-white rounded-[30px] md:rounded-[56px] border-2 border-dashed border-slate-200">
               <i className="fa-solid fa-box-open text-5xl md:text-6xl text-slate-100 mb-6"></i>
               <p className="text-slate-400 font-black uppercase text-xs md:text-sm tracking-[0.2em]">Catálogo vacío</p>
            </div>
          )}
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-6xl h-[95vh] md:h-[90vh] rounded-[30px] md:rounded-[56px] overflow-hidden flex flex-col md:flex-row shadow-2xl relative animate-in zoom-in duration-300">
              <button onClick={() => setSelectedProduct(null)} className="absolute top-4 md:top-8 right-4 md:right-8 w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-100 text-slate-900 flex items-center justify-center z-50 hover:bg-slate-200 transition-all shadow-lg">
                <i className="fa-solid fa-xmark text-lg md:text-xl"></i>
              </button>
              
              <div className="w-full md:w-1/2 h-1/2 md:h-full bg-slate-50 p-4 md:p-10 overflow-y-auto custom-scrollbar">
                 <div className="grid grid-cols-2 gap-3 md:gap-4">
                    {selectedProduct.generatedImages.map((img, i) => (
                      <div key={i} className={`group relative aspect-[3/4] rounded-2xl md:rounded-3xl overflow-hidden shadow-lg ${i === 0 ? 'col-span-2 aspect-[16/9]' : ''}`}>
                         <img src={img} className="w-full h-full object-cover" />
                      </div>
                    ))}
                 </div>
              </div>

              <div className="w-full md:w-1/2 h-1/2 md:h-full p-6 md:p-12 overflow-y-auto space-y-6 md:space-y-10 custom-scrollbar">
                 <h2 className="text-2xl md:text-4xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{selectedProduct.name}</h2>
                 <p className="text-slate-600 font-medium leading-relaxed italic border-l-4 border-emerald-500 pl-4 md:pl-6 text-[10px] md:text-base">"{selectedProduct.commercialDescription}"</p>
                 
                 <div className="flex flex-col sm:flex-row gap-3">
                   <button 
                     onClick={() => copyToClipboard(selectedProduct.technicalDescription, "Ficha técnica copiada!")}
                     className="flex-1 py-4 bg-slate-100 text-slate-800 rounded-2xl text-[8px] md:text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                   >
                     <i className="fa-solid fa-copy mr-2"></i>Ficha Técnica
                   </button>
                   <button 
                     onClick={() => copyToClipboard(selectedProduct.commercialDescription, "Copy comercial copiado!")}
                     className="flex-1 py-4 bg-slate-100 text-slate-800 rounded-2xl text-[8px] md:text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                   >
                     <i className="fa-solid fa-copy mr-2"></i>Copy Comercial
                   </button>
                 </div>

                 <button onClick={() => handleDownloadZip(selectedProduct)} className="w-full py-5 bg-emerald-600 text-white rounded-[20px] md:rounded-[24px] font-black text-[9px] md:text-[10px] uppercase tracking-widest shadow-xl hover:bg-emerald-700 transition-all active:scale-95">
                   <i className="fa-solid fa-file-zipper mr-2"></i> Descargar Pack (.zip)
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ProductPhotography;