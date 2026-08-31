import type { Metadata } from 'next'; import { StandardPublicPage } from '../../../features/public-site/public-pages';
export const metadata: Metadata={title:'Intelligent Control Tower',description:'See how the WAFI Intelligent Control Tower organizes Saudi transportation operations and operational attention.',alternates:{canonical:'/control-tower'}};
export default function Page(){return <StandardPublicPage page="controlTower"/>}
