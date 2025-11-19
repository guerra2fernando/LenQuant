/* eslint-disable */
// @ts-nocheck
import Head from "next/head";

type SEOProps = {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
};

const DEFAULT_SEO = {
  title: "LenQuant - AI-Powered Crypto Trading Platform",
  description: "Advanced AI-assisted cryptocurrency trading platform with predictive analytics, automated strategies, and real-time market insights.",
  siteName: "LenQuant",
  ogImage: "/images/og-image.png", // You can add this image later
  ogType: "website",
};

export function SEO({
  title,
  description,
  canonical,
  ogImage,
  ogType = DEFAULT_SEO.ogType,
}: SEOProps) {
  const seoTitle = title || DEFAULT_SEO.title;
  const seoDescription = description || DEFAULT_SEO.description;
  const seoImage = ogImage || DEFAULT_SEO.ogImage;

  return (
    <Head>
      <title>{seoTitle}</title>
      <meta name="description" content={seoDescription} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      
      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={seoTitle} />
      <meta property="og:description" content={seoDescription} />
      <meta property="og:site_name" content={DEFAULT_SEO.siteName} />
      <meta property="og:image" content={seoImage} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seoTitle} />
      <meta name="twitter:description" content={seoDescription} />
      <meta name="twitter:image" content={seoImage} />
      
      {canonical && <link rel="canonical" href={canonical} />}
      
      {/* Favicons */}
      <link rel="icon" type="image/x-icon" href="/images/favicon/favicon.ico" />
      <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon/favicon-16x16.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="96x96" href="/images/favicon/favicon-96x96.png" />
      
      {/* Apple Touch Icons */}
      <link rel="apple-touch-icon" sizes="57x57" href="/images/favicon/apple-icon-57x57.png" />
      <link rel="apple-touch-icon" sizes="60x60" href="/images/favicon/apple-icon-60x60.png" />
      <link rel="apple-touch-icon" sizes="72x72" href="/images/favicon/apple-icon-72x72.png" />
      <link rel="apple-touch-icon" sizes="76x76" href="/images/favicon/apple-icon-76x76.png" />
      <link rel="apple-touch-icon" sizes="114x114" href="/images/favicon/apple-icon-114x114.png" />
      <link rel="apple-touch-icon" sizes="120x120" href="/images/favicon/apple-icon-120x120.png" />
      <link rel="apple-touch-icon" sizes="144x144" href="/images/favicon/apple-icon-144x144.png" />
      <link rel="apple-touch-icon" sizes="152x152" href="/images/favicon/apple-icon-152x152.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/images/favicon/apple-icon-180x180.png" />
      
      {/* Android Chrome Icons */}
      <link rel="icon" type="image/png" sizes="192x192" href="/images/favicon/android-icon-192x192.png" />
      
      {/* MS Tiles */}
      <meta name="msapplication-TileColor" content="#ffffff" />
      <meta name="msapplication-TileImage" content="/images/favicon/ms-icon-144x144.png" />
      <meta name="msapplication-config" content="/images/favicon/browserconfig.xml" />
      
      {/* Web App Manifest */}
      <link rel="manifest" href="/images/favicon/manifest.json" />
      
      {/* Theme Color */}
      <meta name="theme-color" content="#ffffff" />
    </Head>
  );
}

