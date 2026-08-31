import type { Metadata } from 'next'; import { StandardPublicPage } from '../../../features/public-site/public-pages';
export const metadata: Metadata={title:'Platform',description:'Explore WAFI OS capabilities for planning, execution, operational control, governance and performance.',alternates:{canonical:'/platform'}};
export default function Page(){return <StandardPublicPage page="platform"/>}
