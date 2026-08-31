import type { Metadata } from 'next'; import { StandardPublicPage } from '../../../features/public-site/public-pages';
export const metadata: Metadata={title:'Solutions',description:'WAFI solutions for fleet, transportation, 3PL, distribution and industrial logistics operations.',alternates:{canonical:'/solutions'}};
export default function Page(){return <StandardPublicPage page="solutions"/>}
