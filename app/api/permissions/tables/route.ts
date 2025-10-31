import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const apiPath = path.join(process.cwd(), 'app', 'api');
    const folders = fs.readdirSync(apiPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(name => 
        // Filter out non-table folders
        !['auth', 'database', 'permissions'].includes(name) &&
        !name.includes('.')
      );

    return NextResponse.json({ tables: folders });

  } catch (error) {
    console.error('Error reading API folders:', error);
    return NextResponse.json({ tables: [] });
  }
}