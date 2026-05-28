export async function POST() {
  const response = Response.json({ success: true });
  response.headers.append(
    'Set-Cookie',
    `session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
  );
  return response;
}
