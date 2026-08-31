import type { Metadata } from 'next'; import { StandardPublicPage } from '../../../features/public-site/public-pages';
export const metadata: Metadata={title:'Company',description:'Learn about WAFI’s product vision for modern Saudi transportation and logistics operations.',alternates:{canonical:'/company'}};
export default function Page(){return <StandardPublicPage page="company"/>}
