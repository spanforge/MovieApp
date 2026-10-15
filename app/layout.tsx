import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Moodreel — Find your kind of movie', description: 'Turn your mood into your next movie night. Discover films and where to stream them.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
