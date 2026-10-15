import { NextRequest, NextResponse } from 'next/server';
import { readSubmission, submissionStatus } from '@/lib/intake';
import { validEvent } from '@/lib/events';
export async function POST(request: NextRequest) {
  try {
    const data = await readSubmission(request,1024);
    if (!validEvent(data)) return NextResponse.json({error:'Invalid activity event.'},{status:400});
    console.info(JSON.stringify({type:'moodreel_activity',...data,at:new Date().toISOString()}));
    return new NextResponse(null,{status:204});
  } catch (error) { return NextResponse.json({error:'Activity could not be recorded.'},{status:submissionStatus(error)}); }
}
