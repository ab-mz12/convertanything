export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Wraps an HTML fragment in a complete, self-contained, nicely readable page. */
export function wrapHtmlPage(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { max-width: 52rem; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #111; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; margin: 1rem 0; }
  td, th { border: 1px solid #ccc; padding: 0.3rem 0.6rem; vertical-align: top; }
  pre { white-space: pre-wrap; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}

/** Strip the extension from a file name to use as a document title. */
export function titleFromFileName(name: string): string {
  return name.replace(/\.[A-Za-z0-9]{1,8}$/, '') || 'Document';
}
