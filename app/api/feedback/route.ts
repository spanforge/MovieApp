import { NextRequest, NextResponse } from 'next/server';
import { readSubmission, submissionStatus } from '@/lib/intake';
export async function POST(request: NextRequest) {
  try {
    const input = await readSubmission(request,4096);
    if (!input || typeof input !== 'object') throw new Error('body');
    const data = input as Record<string,unknown>;
    if (!['suggestion','bug','availability','recommendation'].includes(String(data.category)) || typeof data.message !== 'string' || data.message.trim().length < 5 || data.message.length > 1000 || (data.movieId !== undefined && (!Number.isSafeInteger(data.movieId) || Number(data.movieId) < 1))) return NextResponse.json({error:'Choose a topic and enter 5–1,000 characters.'},{status:400});
    const reference = crypto.randomUUID().slice(0,8);
    console.info(JSON.stringify({type:'moodreel_feedback',reference,category:data.category,message:data.message.trim(),movieId:data.movieId,at:new Date().toISOString()}));
    return NextResponse.json({reference},{status:201});
  } catch (error) { return NextResponse.json({error:'Your message could not be sent. Please try again.'},{status:submissionStatus(error)}); }
}
