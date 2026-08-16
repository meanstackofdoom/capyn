export function GET() {
  return Response.json({ status: "ok", service: "capyn-web", version: "0.1.0" });
}
