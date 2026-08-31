import type { Metadata } from 'next'; import Link from 'next/link'; import { LoginGateway } from '../../features/public-site/login-gateway';
export const metadata:Metadata={title:'Login to WAFI OS',description:'Secure access to the WAFI transportation operations platform.',robots:{index:false,follow:false}};
export default function LoginPage(){return <div className="login-page"><Link className="login-back" href="/">← WAFI</Link><LoginGateway/></div>}
