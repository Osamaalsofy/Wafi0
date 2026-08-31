import type { Metadata } from 'next'; import { StandardPublicPage } from '../../../features/public-site/public-pages';
export const metadata: Metadata={title:'Operational Intelligence',description:'Connect operational rules, exception detection, decisions, corrective actions, audit and reporting with WAFI.',alternates:{canonical:'/intelligence'}};
export default function Page(){return <StandardPublicPage page="intelligence"/>}
