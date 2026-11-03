/**
 * Health check route (PRD Section 8).
 * Accessible without access code.
 */
export async function GET() {
  return Response.json({
    ok: true,
    version: '4.0',
    service: 'munshi-backend',
    timestamp: new Date().toISOString(),
  });
}
