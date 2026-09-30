import {S,$$} from './state.js';
const D={
 es:{
  explore:'Explorar',routes:'Rutas',field:'Campo',more:'Más',search:'Buscar en A Lamosa…',
  visitor:'Visitante',research:'Investigación',nearby:'Cerca de mí',favorites:'Favoritos',
  layers:'Capas',map:'Mapa',satellite:'Satélite',offline:'Offline',listen:'Escuchar',
  info:'Información',sources:'Fuentes',startRoute:'Iniciar ruta',stopRoute:'Finalizar',
  contributions:'Aportar información',diagnostic:'Diagnóstico',language:'Idioma',mode:'Modo',
  stories:'Historias',timeline:'Línea del tiempo',downloadOffline:'Descargar A Lamosa offline',
  importGpx:'Importar GPX',exportWork:'Exportar trabajo',fieldTools:'Herramientas de campo',
  publicData:'Contenido público',pending:'Pendiente de verificar'
 },
 gl:{
  explore:'Explorar',routes:'Roteiros',field:'Campo',more:'Máis',search:'Buscar na Lamosa…',
  visitor:'Visitante',research:'Investigación',nearby:'Preto de min',favorites:'Favoritos',
  layers:'Capas',map:'Mapa',satellite:'Satélite',offline:'Sen conexión',listen:'Escoitar',
  info:'Información',sources:'Fontes',startRoute:'Comezar roteiro',stopRoute:'Rematar',
  contributions:'Achegar información',diagnostic:'Diagnóstico',language:'Idioma',mode:'Modo',
  stories:'Historias',timeline:'Liña do tempo',downloadOffline:'Descargar A Lamosa sen conexión',
  importGpx:'Importar GPX',exportWork:'Exportar traballo',fieldTools:'Ferramentas de campo',
  publicData:'Contido público',pending:'Pendente de verificar'
 }
};
export const t=k=>D[S.lang]?.[k]||D.es[k]||k;
export function applyI18n(){
  $$('[data-i18n]').forEach(e=>{const k=e.dataset.i18n;if(k)e.textContent=t(k);});
  $$('[data-i18n-placeholder]').forEach(e=>{const k=e.dataset.i18nPlaceholder;if(k)e.placeholder=t(k);});
  document.documentElement.lang=S.lang==='gl'?'gl':'es';
}
