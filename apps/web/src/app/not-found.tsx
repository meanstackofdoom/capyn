import Link from "next/link";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center p-6"><div className="panel w-full max-w-md p-8"><Brand /><p className="mt-12 font-mono text-[10px] text-muted">404 / ROUTE_NOT_FOUND</p><h1 className="display-title mt-3 text-3xl font-semibold tracking-[-.04em]">This authority surface does not exist.</h1><p className="mt-3 text-sm leading-6 text-muted">Return to the CAPYN website or inspect the working control plane.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/" className="public-primary-button">Back to CAPYN</Link><Link href="/dashboard" className="public-secondary-button">Open demo</Link></div></div></main>;
}
