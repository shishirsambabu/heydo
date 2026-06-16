import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Heydo Admin — Verification Queue',
  description: 'Heydo ops panel: VKYC verification, disputes, fraud, payouts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="topbar">
          <div className="brand">
            Hey<span className="accent">do</span> · Admin
          </div>
          <div className="who">Trust Operations</div>
        </div>
        {children}
      </body>
    </html>
  );
}
