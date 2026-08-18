export function GET() {
  return Response.json({ status: "ok", service: "capyn-web", version: "0.4.0" });
}
