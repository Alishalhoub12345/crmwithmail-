import { Link } from "wouter";
import { EmailLink, PhoneActions } from "@/components/ContactLinks";

export function Footer() {
  return (
    <footer className="bg-secondary text-secondary-foreground pt-16 pb-8 border-t">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="space-y-4">
            <h3 className="font-display font-bold text-xl flex items-center gap-2">
              <span className="bg-primary text-white p-1 rounded">AM</span>
              AutoMarket
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Premium automotive marketplace featuring the best collection of new and used vehicles. Quality guaranteed.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/cars" className="hover:text-primary">Search Cars</Link></li>
              <li><Link href="/contact" className="hover:text-primary">Contact Us</Link></li>
              <li><Link href="/auth" className="hover:text-primary">Login / Register</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-4">Categories</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/cars?category=SUV" className="hover:text-primary">SUVs</Link></li>
              <li><Link href="/cars?category=Sedan" className="hover:text-primary">Sedans</Link></li>
              <li><Link href="/cars?category=Sports" className="hover:text-primary">Sports Cars</Link></li>
              <li><Link href="/cars?category=Electric" className="hover:text-primary">Electric</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-4">Contact Info</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>123 Auto Drive, Car City</li>
              <li><EmailLink email="contact@automarket.com" /></li>
              <li><PhoneActions phone="+1 (555) 123-4567" /></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">© 2024 AutoMarket. All rights reserved.</p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <a href="#" className="hover:text-primary">Privacy Policy</a>
            <a href="#" className="hover:text-primary">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
