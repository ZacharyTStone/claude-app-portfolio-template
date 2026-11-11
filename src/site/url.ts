/** An address as people write it: no scheme, www. or trailing slash
    ("linkedin.com/in/you"). */
export const shortUrl = (href: string): string => href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
