/**
 * Record a CDP screencast of the managed browser page.
 * Usage: CAPTURE_MS=75000 CAPTURE_OUT=demo-frames npx @iwsdk/cli browser run tools/record-demo.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

export default async function run({ cdp, workspaceRoot }) {
  const outDir = path.join(workspaceRoot, process.env.CAPTURE_OUT ?? 'demo-frames');
  const captureMs = Number(process.env.CAPTURE_MS ?? 75000);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  let index = 0;
  const starts = [];
  cdp.on('Page.screencastFrame', async (event) => {
    const file = path.join(outDir, `frame-${String(index).padStart(4, '0')}.jpg`);
    index += 1;
    starts.push(Date.now());
    try {
      fs.writeFileSync(file, Buffer.from(event.data, 'base64'));
    } catch {
      // keep going; a dropped frame is fine
    }
    try {
      await cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
    } catch {
      // session may have ended
    }
  });

  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 88,
    everyNthFrame: 1,
    maxWidth: 1280,
    maxHeight: 720,
  });

  await new Promise((resolve) => setTimeout(resolve, captureMs));
  try {
    await cdp.send('Page.stopScreencast');
  } catch {
    // already stopped
  }
  fs.writeFileSync(
    path.join(outDir, 'meta.json'),
    JSON.stringify({ frames: index, captureMs }),
  );
  return { frames: index, outDir };
}
