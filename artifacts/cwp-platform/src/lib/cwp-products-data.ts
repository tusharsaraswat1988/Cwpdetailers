export interface ProductPricingTier {
  category: string;
  price: number;
  period?: string; // e.g., "per month", "per service", "one-time"
  popular?: boolean;
  features: string[];
}

export interface ProductReview {
  id: string;
  author: string;
  rating: number;
  date: string;
  vehicleOrSite: string;
  comment: string;
  verified: boolean;
}

export interface CwpProduct {
  slug: string;
  title: string;
  shortDescription: string;
  category: "Car Care" | "Detailing" | "Solar Care";
  badge?: string;
  heroImage: string;
  galleryImages: string[];
  startingPrice: number;
  priceUnit: string;
  rating: number;
  totalReviews: number;
  features: string[];
  overview: string;
  inclusions: string[];
  processSteps: { step: number; title: string; description: string }[];
  equipmentAndChemicals: string[];
  guarantees: string[];
  pricingTiers: ProductPricingTier[];
  reviews: ProductReview[];
  serviceType: "daily_cleaning" | "car_wash" | "detailing" | "solar_cleaning" | "glass_treatment";
}

export const CWP_PRODUCTS: Record<string, CwpProduct> = {
  "daily-car-cleaning": {
    slug: "daily-car-cleaning",
    title: "Daily Doorstep Car Cleaning",
    shortDescription: "Morning doorstep exterior microfiber wipe, dust removal & monthly full washes.",
    category: "Car Care",
    badge: "Most Popular Subscription",
    heroImage: "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&w=800&q=80",
    ],
    startingPrice: 1199,
    priceUnit: "/ month",
    rating: 4.9,
    totalReviews: 1840,
    features: [
      "26 Doorstep Daily Wipe & Dusting Visits",
      "2 Deep Foam & Pressure Washes Included",
      "450+ GSM Soft Microfiber (Zero Swirl Promise)",
      "Dedicated Crew in Uniform with GPS Tracking",
    ],
    overview:
      "Say goodbye to local unverified cleaners scratching your car with dirty buckets and rough cloths. CWP provides trained doorstep professionals using separate dry-wipe and wet-wipe microfibers with scratch-prevention spray, ensuring your car is spotlessly shining every single morning before you head out.",
    inclusions: [
      "Daily exterior body wipe with two-sided 450 GSM plush microfiber",
      "Glass, mirrors, and windshield clarity wipe",
      "Wheels and rim surface dusting",
      "Weekly interior vacuum & dashboard dust-off",
      "Two complimentary high-pressure snow foam washes per month",
      "App-based daily completion photos & visit log",
    ],
    processSteps: [
      { step: 1, title: "Dust Extraction", description: "Soft pre-dusting brush removes loose grit without grinding into clear coat." },
      { step: 2, title: "Microfiber Glaze Wipe", description: "Specialized lubricated spray lifts micro-particles into plush 450 GSM cloth." },
      { step: 3, title: "Glass & Mirror Polish", description: "Streak-free glass cleaner for razor-sharp visibility and water resistance." },
      { step: 4, title: "Tyre Dressing & Inspection", description: "Tyre sidewall clean and visual check with report uploaded to your portal." },
    ],
    equipmentAndChemicals: [
      "Meguiar's & Sonax Quick Detailer Lubricants",
      "450 GSM Korean Edgeless Microfiber Towels",
      "100% RO Purified De-ionized Water",
      "Eco-friendly Bio-degradable Foams",
    ],
    guarantees: [
      "100% Scratch-Free Guarantee or free paint correction",
      "Morning arrival before 8:30 AM",
      "Instant feedback & complaint resolution within 2 hours",
    ],
    pricingTiers: [
      {
        category: "Hatchback (Swift, i20, Tiago)",
        price: 1199,
        period: "/ month",
        features: ["26 Daily Visits", "1 Deep Foam Wash", "Daily App Updates"],
      },
      {
        category: "Sedan / Compact SUV (Creta, City, Brezza)",
        price: 1499,
        period: "/ month",
        popular: true,
        features: ["26 Daily Visits", "2 Deep Foam Washes", "Interior Vacuum twice/mo", "App Attendance Logs"],
      },
      {
        category: "Full SUV / Luxury (Fortuner, XUV700, BMW)",
        price: 1799,
        period: "/ month",
        features: ["26 Daily Visits", "2 Deep Foam Washes", "Full Interior Dressing", "Priority Supervisor Care"],
      },
    ],
    reviews: [
      {
        id: "rev-1",
        author: "Tushar Verma",
        rating: 5,
        date: "2 days ago",
        vehicleOrSite: "Hyundai Creta",
        comment: "Earlier my local society cleaner made swirl marks all over the bonnet. Switched to CWP daily subscription 4 months back, paint looks brand new every morning. The photo logs in the app give total peace of mind!",
        verified: true,
      },
      {
        id: "rev-2",
        author: "Dr. Ananya Sharma",
        rating: 5,
        date: "1 week ago",
        vehicleOrSite: "Kia Seltos",
        comment: "Extremely punctual and professional. The 2 full foam washes included in the monthly pack make it unbeatable value. Highly recommend to anyone in Varanasi.",
        verified: true,
      },
      {
        id: "rev-3",
        author: "Rajesh Agrawal",
        rating: 4.8,
        date: "2 weeks ago",
        vehicleOrSite: "Tata Nexon",
        comment: "Their microfiber quality is genuine. No scratches, clean rims, and very polite team.",
        verified: true,
      },
    ],
    serviceType: "daily_cleaning",
  },

  "doorstep-car-wash": {
    slug: "doorstep-car-wash",
    title: "Express Foam & Pressure Car Wash",
    shortDescription: "High-pressure snow foam wash, underbody rinse, interior vacuum & tyre dressing.",
    category: "Car Care",
    badge: "Fast & Convenient",
    heroImage: "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&w=800&q=80",
    ],
    startingPrice: 499,
    priceUnit: "per wash",
    rating: 4.8,
    totalReviews: 920,
    features: [
      "Kärcher High-Pressure Snow Foam Bath",
      "Underbody Chassis Dirt Blast Rinse",
      "Deep Interior Cabin Vacuum & Floor Mats Clean",
      "Alloy Wheel Rim De-greasing & Tyre Gloss",
    ],
    overview:
      "Our mobile detailing van arrives right at your home or office parking with its own power and RO water. We give your vehicle a thorough two-bucket snow foam bath, underbody wheel arch blast, full interior vacuuming, and dashboard UV polish.",
    inclusions: [
      "High-pressure water rinse to loosen mud and grime",
      "pH-neutral high-density snow foam application",
      "Soft mitt contact wash from roof to rocker panels",
      "Full interior cabin and boot vacuuming",
      "Floor mat shampooing and high-pressure dry",
      "Dashboard, console & door panel UV dressing",
      "Tyre and alloy wheel gloss treatment",
    ],
    processSteps: [
      { step: 1, title: "Pre-Rinse & Underbody", description: "High-pressure 140 bar blast knocks away wheel well mud and road grit." },
      { step: 2, title: "Snow Foam Soak", description: "Thick clinging foam encapsulates dirt particles for zero-contact loosen." },
      { step: 3, title: "Microfiber Mitt Wash", description: "Gentle dual-bucket agitation with grit guard protection." },
      { step: 4, title: "Interior Cabin Spa", description: "Powerful vacuuming of upholstery, mats, AC vents, and glass polish." },
    ],
    equipmentAndChemicals: [
      "Kärcher High-Pressure Professional Washer",
      "Chemical Guys pH Neutral Snow Foam",
      "3M Interior Dressing & Protectant",
      "Dual-motor High-Torque Vacuum Extractors",
    ],
    guarantees: [
      "100% Water spot free finish (RO Water only)",
      "No electricity or water required from customer",
      "45 to 60 minute complete doorstep turnaround",
    ],
    pricingTiers: [
      {
        category: "Hatchback (Swift, WagonR, Baleno)",
        price: 499,
        period: "per wash",
        features: ["Full Foam Wash", "Interior Vacuum", "Dashboard Polish", "Tyre Dressing"],
      },
      {
        category: "Sedan / Compact SUV (City, Creta, Nexon)",
        price: 649,
        period: "per wash",
        popular: true,
        features: ["Underbody Rinse", "Snow Foam Wash", "Full Interior Vacuum", "Engine Bay Dusting"],
      },
      {
        category: "Full Size SUV / 7-Seater (Fortuner, Safari, XUV)",
        price: 799,
        period: "per wash",
        features: ["Heavy Mud Blast", "Snow Foam Wash", "Boot & 3-Row Vacuum", "Door Jam Detailing"],
      },
    ],
    reviews: [
      {
        id: "rev-w1",
        author: "Manish Pandey",
        rating: 5,
        date: "3 days ago",
        vehicleOrSite: "Honda City",
        comment: "They brought their own water and power! The snow foam wash took 50 minutes and my car looked like it just rolled out of the showroom.",
        verified: true,
      },
      {
        id: "rev-w2",
        author: "Vikas Keshari",
        rating: 4.8,
        date: "2 weeks ago",
        vehicleOrSite: "Mahindra Thar",
        comment: "Great underbody mud removal after a monsoon highway drive. The detailers are courteous and thorough.",
        verified: true,
      },
    ],
    serviceType: "car_wash",
  },

  "interior-detailing": {
    slug: "interior-detailing",
    title: "Deep Interior Spa & Detailing",
    shortDescription: "Antibacterial steam extraction, upholstery shampoo & full cabin sanitization.",
    category: "Detailing",
    badge: "Deep Restoration",
    heroImage: "https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=800&q=80",
    ],
    startingPrice: 1499,
    priceUnit: "per package",
    rating: 4.9,
    totalReviews: 650,
    features: [
      "Deep Foam Seat Extraction for Fabric & Leather",
      "140°C High-Pressure Steam AC Vent Sanitization",
      "Roof Headliner Stain & Smoke Removal",
      "Dashboard, Console & Door Trim Conditioning",
    ],
    overview:
      "Over time, car interiors trap food odors, dust mites, sweat, bacteria, and stubborn spills. Our Deep Interior Spa goes beyond regular vacuuming. Using commercial injection-extraction machines and pressurized steam, we lift deep-seated dirt from seats, carpets, headliners, and AC ducts, leaving your cabin sterile, fresh, and like new.",
    inclusions: [
      "High-power extraction cleaning of seats, floor carpets, and boot space",
      "Roof headliner stain spot treatment and gentle sponge clean",
      "High-temperature steam sterilization of air conditioning vents (kills mold & odors)",
      "Dashboard, console, glove box, and cup holder deep degrease and UV protection",
      "Door panels, rubber weatherstrips, and seat belt cleaning",
      "Antimicrobial ozone cabin deodorization spray",
    ],
    processSteps: [
      { step: 1, title: "Dry Dust & Particle Removal", description: "Heavy-duty dual vacuum extraction across all seams and fabrics." },
      { step: 2, title: "Chemical Foam Scrub", description: "Enzyme-based stain lifters applied to seats and carpets with soft bristle drills." },
      { step: 3, title: "Hot Extraction Rinse", description: "Industrial machine injects clean fluid and extracts murky soiled water." },
      { step: 4, title: "Steam Sanitize & Protect", description: "140°C steam through air vents, leather feeding balm & matte UV coating." },
    ],
    equipmentAndChemicals: [
      "Kärcher Puzzi 10/1 Spray Extraction Cleaner",
      "Optima Commercial High-Pressure Steamer",
      "Meguiar's Carpet & Upholstery Cleaner",
      "3M Leather & Vinyl Restorer Balm",
    ],
    guarantees: [
      "99.9% Bacteria and germ reduction in AC ducts",
      "Zero sticky residue on plastics or leather",
      "Seat moisture drying accelerated with hot blowers",
    ],
    pricingTiers: [
      {
        category: "Hatchback (e.g. Swift, i10, Polo)",
        price: 1499,
        period: "one-time",
        features: ["5 Seats Deep Clean", "Floor Carpet Shampoo", "AC Steam Clean", "Dashboard Care"],
      },
      {
        category: "Sedan / Mid SUV (e.g. City, Creta, Kushaq)",
        price: 1999,
        period: "one-time",
        popular: true,
        features: ["5 Seats + Boot Clean", "Full Headliner Restored", "AC Duct Sanitization", "Leather Conditioning"],
      },
      {
        category: "7-Seater / Full SUV (e.g. Fortuner, Innova, Safari)",
        price: 2499,
        period: "one-time",
        features: ["3 Rows All Seats Clean", "Heavy Stain Extraction", "Full Floor & Mat Spa", "Ozone Deodorization"],
      },
    ],
    reviews: [
      {
        id: "rev-i1",
        author: "Sunil Tripathi",
        rating: 5,
        date: "1 week ago",
        vehicleOrSite: "Toyota Innova Crysta",
        comment: "Had milk spilled on the rear seat that started smelling awful. CWP team steam extracted it and the smell is 100% gone! Outstanding job.",
        verified: true,
      },
      {
        id: "rev-i2",
        author: "Neha Srivastava",
        rating: 5,
        date: "3 weeks ago",
        vehicleOrSite: "Volkswagen Taigun",
        comment: "The AC smells completely fresh now and the steering/dashboard feel factory fresh without any tacky shine. 10/10.",
        verified: true,
      },
    ],
    serviceType: "detailing",
  },

  "ceramic-coating": {
    slug: "ceramic-coating",
    title: "9H Ceramic Coating & Paint Protection",
    shortDescription: "Multi-year hydrophobic glass shield, swirl removal & showroom mirror shine.",
    category: "Detailing",
    badge: "Ultimate Protection",
    heroImage: "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&w=800&q=80",
    ],
    startingPrice: 4999,
    priceUnit: "package",
    rating: 5.0,
    totalReviews: 310,
    features: [
      "Multi-stage Paint Correction (Swirl & Scratch Removal)",
      "9H Hardness Nano-Ceramic Protective Shield",
      "Extreme Hydrophobic Water & Mud Beading Effect",
      "1 to 3 Years Warranty with Free Maintenance Coats",
    ],
    overview:
      "Varanasi's harsh sun, dust, bird droppings, and hard water cause dull paint, oxidation, and micro-scratches. Our 9H Ceramic Coating chemically bonds with your car's clear coat to form a permanent sacrificial barrier. It provides an unbelievable deep wet gloss, blocks UV fade, and makes washing your car effortless as mud and water instantly slide off.",
    inclusions: [
      "Decontamination wash with clay bar treatment to remove tree sap & iron fallouts",
      "2-Stage compounding and polishing to eliminate up to 90% swirl marks",
      "Isopropyl alcohol (IPA) panel wipe for pristine ceramic bonding",
      "Two coats of 9H Nano-Ceramic Coating applied to all painted panels",
      "Ceramic coating on headlights, tail lights, and exterior trim",
      "Infrared curing lamp treatment for maximum ceramic crystallization",
      "Official warranty card with inspection schedule",
    ],
    processSteps: [
      { step: 1, title: "Clay Bar Decon", description: "Lifts embedded industrial fallout, brake dust, and tar spots from paint pore." },
      { step: 2, title: "Paint Correction", description: "Dual-action machine polishing removes surface scratches, swirls, and haze." },
      { step: 3, title: "9H Ceramic Bonding", description: "Carefully hand-leveled in crosshatch pattern for uniform crystal thickness." },
      { step: 4, title: "IR Heat Curing", description: "Infrared lamps cure the coating to glass hardness before vehicle release." },
    ],
    equipmentAndChemicals: [
      "Gtechniq & CarPro Cquartz 9H Ceramic Coatings",
      "Rupes BigFoot Dual Action Polishers",
      "Menzerna Germany Polishing Compounds",
      "Short-wave Infrared Curing Lamp Units",
    ],
    guarantees: [
      "Written 1, 2, or 3-Year Gloss & Hydrophobicity Warranty",
      "Free top-up maintenance coat after 6 months",
      "Up to 90% swirl reduction guaranteed",
    ],
    pricingTiers: [
      {
        category: "1-Year Shield (Hatchback / Sedan)",
        price: 4999,
        period: "package",
        features: ["1-Stage Polish", "1 Coat 9H Ceramic", "1-Year Warranty", "1 Free Maintenance Coat"],
      },
      {
        category: "2-Year Pro (Compact SUV / Sedan)",
        price: 7999,
        period: "package",
        popular: true,
        features: ["2-Stage Paint Correction", "2 Coats 9H Ceramic", "2-Year Warranty", "2 Free Maintenance Coats"],
      },
      {
        category: "3-Year Diamond (Full SUV / Luxury)",
        price: 11999,
        period: "package",
        features: ["Multi-Stage Correction", "3 Coats 9H + Top Coat", "3-Year Warranty", "Alloy & Glass Coating Included"],
      },
    ],
    reviews: [
      {
        id: "rev-c1",
        author: "Anurag Mishra",
        rating: 5,
        date: "2 weeks ago",
        vehicleOrSite: "BMW 3 Series",
        comment: "The mirror reflection after the 2-stage correction and ceramic coating is breathtaking. Water literally sheets off like magic. Worth every rupee.",
        verified: true,
      },
      {
        id: "rev-c2",
        author: "Devendra Yadav",
        rating: 5,
        date: "1 month ago",
        vehicleOrSite: "Tata Harrier Dark Edition",
        comment: "Black cars are a nightmare to maintain without ceramic coating. CWP did an incredible job removing existing swirl marks. Highly recommended!",
        verified: true,
      },
    ],
    serviceType: "detailing",
  },

  "solar-cleaning": {
    slug: "solar-cleaning",
    title: "Rooftop Solar Panel Cleaning & Maintenance",
    shortDescription: "Efficiency restoration, soft-bristle de-dusting & generation output boost.",
    category: "Solar Care",
    badge: "Boost Generation Up to 25%",
    heroImage: "https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1508873696983-2df570464756?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=800&q=80",
    ],
    startingPrice: 399,
    priceUnit: "per visit / AMC",
    rating: 4.9,
    totalReviews: 420,
    features: [
      "Up to 25% Increase in Solar Electricity Generation",
      "Specialized Telescopic Soft-Bristle Non-Abrasive Brushes",
      "Zero Hard-Water Scaling with De-Mineralized RO Rinse",
      "Before & After Solar Inverter Generation Report",
    ],
    overview:
      "In urban Indian conditions, dust, soot, and bird droppings deposit heavily on solar panels within weeks, cutting power generation by up to 25% to 30%. Cleaning with domestic tap water leaves hard mineral stains that bake under sunlight and permanently degrade cell output. CWP uses de-mineralized water and specialized rotating telescopic brushes to restore maximum peak wattage safely without scratching glass coatings.",
    inclusions: [
      "Full rooftop inspection of wiring, clamps, and panel glass integrity",
      "Dry loose dust sweeping using specialized anti-static brushes",
      "Low-pressure de-mineralized water soak to dissolve bird droppings & sap",
      "Soft-bristle telescopic agitation across every single panel cell",
      "Spotless de-ionized final rinse preventing hard water scaling",
      "Inverter generation output check and post-service WhatsApp report",
    ],
    processSteps: [
      { step: 1, title: "Inspection & Safety", description: "Rooftop anchoring, electrical safety check, and pre-cleaning output logging." },
      { step: 2, title: "Pre-Soak & Loosening", description: "De-mineralized water soak loosens acidic bird droppings without scratching." },
      { step: 3, title: "Telescopic Brush Scrub", description: "Gentle soft-bristle scrubbing across panel margins and glass surface." },
      { step: 4, title: "Pure Rinse & Report", description: "Streak-free rinse leaves 0 mineral residue; before/after photos uploaded." },
    ],
    equipmentAndChemicals: [
      "Carbon-Fiber Telescopic Water-Fed Poles (up to 35 feet)",
      "Solar-grade Micro-Bristle Non-Scratch Brushes",
      "De-mineralized RO Pure Water Units (< 10 ppm TDS)",
      "Thermal Hotspot & Inverter Output Analyzers",
    ],
    guarantees: [
      "Zero scratch guarantee on photovoltaic anti-reflective coatings",
      "Trained safety-harnessed rooftop technicians",
      "Noticeable generation spike on your solar inverter meter",
    ],
    pricingTiers: [
      {
        category: "Residential 1 kW to 3 kW (Up to 8 Panels)",
        price: 399,
        period: "per wash",
        features: ["Up to 8 Panels Cleaned", "Pure RO Rinse", "Inverter Check", "Before/After Photos"],
      },
      {
        category: "Residential 4 kW to 6 kW (Up to 16 Panels)",
        price: 699,
        period: "per wash",
        popular: true,
        features: ["Up to 16 Panels Cleaned", "Bird Dropping Removal", "Structure Tightness Check", "Digital Generation Log"],
      },
      {
        category: "Annual AMC Package (12 Visits / Year)",
        price: 3499,
        period: "/ year",
        features: ["12 Monthly Scheduled Cleans", "Priority Emergency Visit", "Full Electrical Diagnostics", "Best Value"],
      },
    ],
    reviews: [
      {
        id: "rev-s1",
        author: "Rameshwar Prasad",
        rating: 5,
        date: "5 days ago",
        vehicleOrSite: "5 kW Rooftop Solar Plant",
        comment: "My daily generation was stuck at 18 units due to dust. After CWP cleaned the panels yesterday, it jumped back to 24.5 units! The difference is unbelievable.",
        verified: true,
      },
      {
        id: "rev-s2",
        author: "Alok Jaiswal",
        rating: 5,
        date: "2 weeks ago",
        vehicleOrSite: "3 kW Residential Solar",
        comment: "They arrived with safety gear and long telescopic water pipes. No hassle climbing on the tin roof yourself. Annual AMC is totally worth it.",
        verified: true,
      },
    ],
    serviceType: "solar_cleaning",
  },

  "glass-repellent": {
    slug: "glass-repellent",
    title: "Windshield & Glass Rain Repellent Treatment",
    shortDescription: "Hydrophobic water beading, anti-glare night treatment & crystal clear vision.",
    category: "Detailing",
    badge: "Monsoon Essential",
    heroImage: "https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=800&q=80",
    ],
    startingPrice: 799,
    priceUnit: "treatment",
    rating: 4.8,
    totalReviews: 280,
    features: [
      "Hydrophobic Nanotech: Raindrops fly off windshield above 45 km/h",
      "Eliminates Wiper Judder and Ghosting Marks",
      "Anti-Glare Formula reduces night high-beam blinding by 35%",
      "6 Months Long-Lasting Durability per application",
    ],
    overview:
      "Driving in heavy rain or at night with oncoming high beams can be treacherous. Our Glass Rain Repellent Treatment polishes off hard water scaling and bonds a fluoropolymer nano-shield to the glass. Rain immediately beads into tight droplets and flies off the windshield with wind velocity, providing effortless optical clarity with minimal wiper use.",
    inclusions: [
      "Deep glass cleaning with cerium oxide polish to remove acid rain & water spots",
      "Alcohol wipe down for pristine glass bonding",
      "Application of 2 layers of hydrophobic glass ceramic sealant",
      "Windshield, side windows, rear windshield & ORVM mirrors included",
      "Wiper blade cleaning and rubber rejuvenation treatment",
    ],
    processSteps: [
      { step: 1, title: "Glass De-scaling", description: "Cerium oxide compound strips stubborn road film, tree sap, and hard water etching." },
      { step: 2, title: "IPA Surface Prep", description: "Removes any oils or residue to guarantee maximum molecular bond." },
      { step: 3, title: "Nano-Shield Coating", description: "Applied in tight circles and buffed clear to 100% optical transparency." },
      { step: 4, title: "Wiper Alignment", description: "Wiper blades cleaned and treated to prevent chattering and skipping." },
    ],
    equipmentAndChemicals: [
      "Soft99 Glaco Ultra Glass Coating",
      "CarPro CeriGlass Glass Polish",
      "Waffle-Weave Microfiber Glass Polishing Towels",
    ],
    guarantees: [
      "6 Months rain repellent performance",
      "100% Streak-free optical clarity",
      "Drastic reduction in night oncoming headlight glare",
    ],
    pricingTiers: [
      {
        category: "Front Windshield Only",
        price: 799,
        period: "one-time",
        features: ["Front Windshield Treated", "Water Spot Polish", "Wiper Treatment", "6 Months Durability"],
      },
      {
        category: "Full Car Glass Pack (Front, Rear, 4 Windows, Mirrors)",
        price: 1299,
        period: "one-time",
        popular: true,
        features: ["All Glass Panels Treated", "ORVM Rain Repellent", "Full Scale Polish", "Best Monsoon Protection"],
      },
    ],
    reviews: [
      {
        id: "rev-g1",
        author: "Prabhat Gupta",
        rating: 5,
        date: "2 weeks ago",
        vehicleOrSite: "Skoda Kushaq",
        comment: "Driving on the highway in heavy rain felt like a video game — the water just rolled up and off without even needing the wipers on high speed! Superb product.",
        verified: true,
      },
    ],
    serviceType: "glass_treatment",
  },
};

export const CWP_PRODUCT_LIST = Object.values(CWP_PRODUCTS);
