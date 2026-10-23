# Guía: proteger el saldo de Google Cloud (5 pasos)

Proyecto con los créditos: **luz-creative-engine-2** (vencen el 29 de diciembre de 2026, unos USD 290).
Esto avisa por correo si el gasto se acerca al saldo. La app además tiene sus propios topes, pero esta alerta es la red de seguridad de Google.

1. Entra a https://console.cloud.google.com, arriba elige el proyecto **luz-creative-engine-2** y en el menú (las tres rayitas) abre **Facturación** (Billing). Si te pide elegir una cuenta de facturación, elige la que tiene los créditos.

2. En el menú de la izquierda de Facturación, entra a **Presupuestos y alertas** (Budgets & alerts) y aprieta **Crear presupuesto**.

3. Ponle de nombre "Piloto joyería". En "Alcance" deja el proyecto **luz-creative-engine-2**. En "Monto" elige **Importe específico** y escribe **290** (dólares).

4. En "Acciones" agrega los umbrales **50 %**, **80 %** y **100 %** (el 100 % es el último aviso: el tuyo llega cuando ya te gastaste todo). Marca **Enviar alertas por correo** a los administradores de la facturación y agrega tu correo y el de quien vigile el gasto. Aprieta **Finalizar**.

5. Revisa los límites de uso de Vertex: menú **IAM y administración → Cuotas y límites del sistema**, escribe "Vertex AI" en el filtro y mira las líneas de "Generate content requests per minute" y de imágenes. Si un límite es muy alto, bájalo con "Editar cuotas" (a un número chico, como 30 por minuto) para que ningún error de la app pueda gastar de golpe. De paso, en Facturación → **Informes**, mira una vez a la semana cuánto llevas gastado.

Importante: un presupuesto de Google **avisa, no corta solo**. Quien corta es el libro de gasto de la app (tope diario ~USD 4 y tope total).
