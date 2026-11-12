/* The clipboard, which the browser can refuse: whoever copies is told
   whether it worked, and says so to the visitor ("Copied", or that it
   couldn't). */

/** Copies text: false when the browser won't (no permission, say). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
