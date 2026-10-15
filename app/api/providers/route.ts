import { NextRequest, NextResponse } from 'next/server';
import { countries } from '@/lib/discovery';
import { tmdb } from '@/lib/tmdb';
export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get('region') ?? 'IN';
  if (!(region in countries)) return NextResponse.json({ error: 'Unsupported country.' }, { status: 400 });
  try {
    const data = await tmdb(`/watch/providers/movie?watch_region=${region}&language=en-US`);
    return NextResponse.json({ providers: data.results.map((p: { provider_id: number; provider_name: string }) => ({ provider_id: p.provider_id, provider_name: p.provider_name })) });
  } catch { return NextResponse.json({ error: 'Could not load services. Retry, or search across all services.' }, { status: 502 }); }
}
