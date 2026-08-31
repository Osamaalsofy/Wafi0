import type { Metadata } from 'next'; import { StandardPublicPage } from '../../../features/public-site/public-pages';
export const metadata: Metadata={title:'ITS Future Vision',description:'Explore WAFI’s future architecture direction for connected and intelligent transportation.',alternates:{canonical:'/its'}};
export default function Page(){return <StandardPublicPage page="its"/>}
