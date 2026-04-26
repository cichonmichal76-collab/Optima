import { exportReportFile } from "./exporters.js";
import { parseInputFile } from "./parsers.js";
import { $, escapeHtml, parseAmount } from "./utils.js";

const MODULE_LABELS = {
  VAT_PURCHASE: "Rejestr VAT zakup",
  VAT_SALE: "Rejestr VAT sprzedaż",
  LEDGER: "Zapisy księgowe",
  ACCOUNT_PLAN: "Plan kont",
  SETTLEMENTS: "Rozrachunki",
  BANK: "Bank / kasa",
  JPK_DECLARATIONS: "JPK i deklaracje",
  CONTRACTORS: "Kontrahenci",
  DOCUMENTS: "Dokumenty i załączniki",
  FIXED_ASSETS: "Środki trwałe",
  HR_PAYROLL: "Kadry i płace",
};

const ADMIN_EXPORT_PROFILES = [
  {
    code: "VAT_PURCHASE",
    label: MODULE_LABELS.VAT_PURCHASE,
    support: "sql",
    supportLabel: "Pełna walidacja SQL",
    formats: [".xlsx", ".xls", ".csv"],
    description: "Eksport z rejestru VAT zakupu.",
  },
  {
    code: "VAT_SALE",
    label: MODULE_LABELS.VAT_SALE,
    support: "sql",
    supportLabel: "Pełna walidacja SQL",
    formats: [".xlsx", ".xls", ".csv"],
    description: "Eksport z rejestru VAT sprzedaży.",
  },
  {
    code: "LEDGER",
    label: MODULE_LABELS.LEDGER,
    support: "sql",
    supportLabel: "Pełna walidacja SQL",
    formats: [".xlsx", ".xls", ".csv"],
    description: "Eksport zapisów księgowych z dzienników.",
  },
  {
    code: "ACCOUNT_PLAN",
    label: MODULE_LABELS.ACCOUNT_PLAN,
    support: "sql",
    supportLabel: "Pełna walidacja SQL",
    formats: [".xlsx", ".xls", ".csv"],
    description: "Eksport planu kont i znaczników JPK.",
  },
  {
    code: "SETTLEMENTS",
    label: MODULE_LABELS.SETTLEMENTS,
    support: "sql",
    supportLabel: "Pełna walidacja SQL",
    formats: [".xlsx", ".xls", ".csv"],
    description: "Rozrachunki i dokumenty nierozliczone.",
  },
  {
    code: "BANK",
    label: MODULE_LABELS.BANK,
    support: "sql",
    supportLabel: "Pełna walidacja SQL",
    formats: [".xlsx", ".xls", ".csv"],
    description: "Zapisy kasowe i bankowe.",
  },
  {
    code: "CONTRACTORS",
    label: MODULE_LABELS.CONTRACTORS,
    support: "preview",
    supportLabel: "Parser i podgląd",
    formats: [".xlsx", ".xls", ".csv"],
    description: "Kartoteka kontrahentów z listy Ogólne / Kontrahenci.",
  },
  {
    code: "FIXED_ASSETS",
    label: MODULE_LABELS.FIXED_ASSETS,
    support: "preview",
    supportLabel: "Parser i podgląd",
    formats: [".xlsx", ".xls", ".csv"],
    description: "Środki trwałe i dokumenty środków trwałych.",
  },
  {
    code: "HR_PAYROLL",
    label: MODULE_LABELS.HR_PAYROLL,
    support: "preview",
    supportLabel: "Parser i podgląd",
    formats: [".xlsx", ".xls", ".csv"],
    description: "Listy płac i dane kadrowe.",
  },
  {
    code: "JPK_DECLARATIONS",
    label: MODULE_LABELS.JPK_DECLARATIONS,
    support: "preview",
    supportLabel: "Parser techniczny / podgląd",
    formats: [".xml", ".xlsx", ".xls"],
    description: "Pliki JPK oraz arkusze Excel generowane przy eksporcie JPK.",
  },
];

const ADMIN_PROFILES_BY_CODE = Object.fromEntries(ADMIN_EXPORT_PROFILES.map((profile) => [profile.code, profile]));
const ADMIN_SQL_VALIDATION_KINDS = new Set(
  ADMIN_EXPORT_PROFILES.filter((profile) => profile.support === "sql").map((profile) => profile.code),
);

const ADMIN_VALIDATION_LABELS = {
  VAT_PURCHASE: "Rejestr VAT zakup",
  VAT_SALE: "Rejestr VAT sprzedaż",
  LEDGER: "Zapisy księgowe",
  ACCOUNT_PLAN: "Plan kont",
};

const REPORT_GROUPS = [
  {
    id: "dashboards",
    title: "Dashboardy nadrzędne",
    reports: [
      {
        key: "dashboard-packages",
        title: "Status paczek",
        section: "Dashboardy nadrzędne",
        summary: "Widok zarządczy pokazujący liczbę paczek, ich status, błędy, brak schematów i dokumenty do obsługi.",
        question: "Które paczki są gotowe do pracy, a które blokują zamknięcie miesiąca?",
        priority: "Krytyczny",
        sources: ["Optima", "KSeF", "Bank", "OCR", "Excel"],
        filters: ["Okres od-do", "Źródło danych", "Status paczki", "Data importu", "Osoba odpowiedzialna"],
        tags: ["dashboard", "miesiąc", "status paczki", "zamknięcie"],
        primaryModule: "DOCUMENTS",
        relatedModules: ["DOCUMENTS", "LEDGER", "VAT_PURCHASE", "VAT_SALE", "SETTLEMENTS"],
        controls: [
          "Liczba paczek, dokumentów i błędów w paczkach.",
          "Dokumenty bez schematu, bez dekretu i do ręcznej obsługi.",
          "Status gotowości paczki: OK, ostrzeżenia, błędy, niekompletna, do uzgodnienia, zablokowana.",
        ],
        layout: ["Nazwa paczki", "Źródło", "Okres", "Data importu", "Liczba dokumentów", "Status paczki", "Dokumenty z błędami"],
        alerts: ["Paczka niekompletna.", "Paczka zablokowana.", "Rozbieżności między źródłami."],
      },
      {
        key: "dashboard-schemes",
        title: "Schematy księgowe",
        section: "Dashboardy nadrzędne",
        summary: "Dashboard automatyzacji księgowań: ze schematem, bez schematu, schemat bez dekretu, dekrety ręczne i błędne dekrety.",
        question: "Czy automaty księgowe działają i gdzie trzeba poprawić reguły schematów?",
        priority: "Krytyczny",
        sources: ["Optima"],
        filters: ["Okres od-do", "Typ dokumentu", "Kategoria", "Status schematu", "Osoba księgująca"],
        tags: ["dashboard", "schematy", "automatyzacja", "dekretacja"],
        primaryModule: "LEDGER",
        relatedModules: ["LEDGER", "DOCUMENTS", "ACCOUNT_PLAN"],
        controls: [
          "Dokumenty ze schematem, bez schematu i ze schematem bez dekretu.",
          "Dekrety ręczne oraz schematy błędne.",
          "Najczęściej używane i nieużywane schematy.",
        ],
        layout: ["Obszar", "Ze schematem", "Bez schematu", "Z dekretem", "Bez dekretu", "Do weryfikacji"],
        alerts: ["Schemat nie wygenerował dekretu.", "Duży udział księgowań ręcznych.", "Schemat istnieje, ale dokumenty idą ręcznie."],
      },
      {
        key: "dashboard-vat",
        title: "VAT / JPK",
        section: "Dashboardy nadrzędne",
        summary: "Widok spójności VAT należnego i naliczonego z dokumentami, dekretami, rejestrami i JPK.",
        question: "Czy VAT jest zgodny między rejestrem, dekretami i deklaracją?",
        priority: "Krytyczny",
        sources: ["Optima", "JPK", "KSeF"],
        filters: ["Okres od-do", "Status VAT", "Typ dokumentu", "Stawka VAT", "Kontrahent"],
        tags: ["dashboard", "VAT", "JPK", "ryzyko podatkowe"],
        primaryModule: "VAT_PURCHASE",
        relatedModules: ["VAT_PURCHASE", "VAT_SALE", "JPK_DECLARATIONS", "LEDGER"],
        controls: [
          "VAT z dokumentów kontra VAT z dekretów.",
          "VAT z rejestrów kontra VAT z JPK.",
          "Stawki nietypowe, korekty w złym okresie i brak podstawy dla 0% lub zw.",
        ],
        layout: ["VAT należny", "VAT naliczony", "Do zapłaty / zwrotu", "Ryzyka VAT", "KSeF vs VAT", "JPK vs rejestry"],
        alerts: ["VAT w dekrecie niezgodny z VAT z dokumentu.", "Korekta VAT w złym okresie.", "Faktura z VAT bez konta VAT."],
      },
      {
        key: "dashboard-bank",
        title: "Bank i płatności",
        section: "Dashboardy nadrzędne",
        summary: "Widok gotówki, nierozpoznanych operacji, przeterminowanych płatności i otwartych rozrachunków.",
        question: "Czy przepływy pieniężne i rozrachunki są spójne z dokumentami i księgą?",
        priority: "Wysoki",
        sources: ["Bank", "Optima"],
        filters: ["Okres od-do", "Status płatności", "Waluta", "Kontrahent", "Konto bankowe"],
        tags: ["dashboard", "bank", "płatności", "rozrachunki"],
        primaryModule: "BANK",
        relatedModules: ["BANK", "SETTLEMENTS", "LEDGER"],
        controls: [
          "Saldo początkowe plus obroty równa się saldo końcowe.",
          "Płatności bez faktur oraz faktury bez płatności.",
          "Należności i zobowiązania przeterminowane.",
        ],
        layout: ["Saldo banków", "Wpływy", "Wydatki", "Płatności nierozpoznane", "Należności przeterminowane", "Zobowiązania do zapłaty"],
        alerts: ["Płatność bez dokumentu.", "Bank bez dekretu.", "Rachunek spoza białej listy."],
      },
      {
        key: "dashboard-management",
        title: "Zarząd",
        section: "Dashboardy nadrzędne",
        summary: "Raport zarządczy o przychodach, kosztach, wyniku, cash flow i najważniejszych alertach krytycznych.",
        question: "Jak wygląda wynik firmy i które ryzyka wymagają decyzji zarządczej?",
        priority: "Wysoki",
        sources: ["Optima", "Bank", "VAT", "Rozrachunki"],
        filters: ["Okres od-do", "Projekt", "MPK", "Waluta", "Kwota od-do"],
        tags: ["dashboard", "zarząd", "wynik", "cash flow"],
        primaryModule: "LEDGER",
        relatedModules: ["LEDGER", "BANK", "SETTLEMENTS", "VAT_SALE", "VAT_PURCHASE"],
        controls: [
          "Przychody, koszty, wynik i marża.",
          "Cash flow oraz zobowiązania podatkowe.",
          "Alerty krytyczne blokujące miesiąc.",
        ],
        layout: ["Przychody", "Koszty", "Wynik", "Cash flow", "Należności", "Zobowiązania", "Alerty krytyczne"],
        alerts: ["Duży wzrost kosztu miesiąc do miesiąca.", "Krytyczne blokady podatkowe.", "Należności i zobowiązania wymagające decyzji."],
      },
    ],
  },
  {
    id: "packages",
    title: "Paczki i zamknięcie",
    reports: [
      {
        key: "package-status",
        title: "Status paczki danych",
        section: "Paczki i zamknięcie",
        summary: "Pierwszy raport po imporcie każdej paczki danych. Pokazuje kompletność, sumy, błędy, brak schematów i brak dekretów.",
        question: "Czy paczka danych jest kompletna i gotowa do dalszej pracy księgowej?",
        priority: "Krytyczny",
        queryKey: "package-status",
        sources: ["Optima", "KSeF", "Bank", "OCR", "Excel"],
        filters: ["Okres od-do", "Źródło danych", "Data importu", "Typ dokumentu", "Status księgowania"],
        tags: ["raport nadrzędny", "po imporcie", "status paczki"],
        primaryModule: "DOCUMENTS",
        relatedModules: ["DOCUMENTS", "LEDGER", "VAT_PURCHASE", "VAT_SALE", "SETTLEMENTS"],
        controls: [
          "Liczba dokumentów.",
          "Suma netto, VAT i brutto.",
          "Dokumenty bez schematu.",
          "Dokumenty bez dekretu.",
          "Dokumenty do ręcznej weryfikacji.",
          "Status gotowości paczki.",
        ],
        layout: [
          "Nazwa paczki",
          "Źródło",
          "Okres od-do",
          "Data importu",
          "Liczba dokumentów",
          "Suma netto",
          "Suma VAT",
          "Suma brutto",
          "Liczba dokumentów bez schematu",
          "Liczba dokumentów bez dekretu",
          "Liczba dokumentów do ręcznej weryfikacji",
          "Status paczki",
        ],
        alerts: ["Brak danych źródłowych.", "Dużo dokumentów bez schematu.", "Kontrola techniczna nieprzeszła."],
      },
      {
        key: "closing-blockers",
        title: "Blokady zamknięcia miesiąca",
        section: "Paczki i zamknięcie",
        summary: "Raport blokad podzielonych na techniczne, księgowe, schematowe, VAT, KSeF, rozrachunkowe, merytoryczne i zarządcze.",
        question: "Co dokładnie blokuje zamknięcie miesiąca i kto powinien usunąć blokadę?",
        priority: "Krytyczny",
        queryKey: "closing-blockers",
        sources: ["Optima", "KSeF", "Bank", "OCR"],
        filters: ["Okres od-do", "Typ blokady", "Osoba odpowiedzialna", "Priorytet", "Kwota od-do"],
        tags: ["blokady", "zamknięcie miesiąca", "priorytet"],
        primaryModule: "DOCUMENTS",
        relatedModules: ["DOCUMENTS", "LEDGER", "VAT_SALE", "VAT_PURCHASE", "SETTLEMENTS", "BANK"],
        controls: [
          "Blokady techniczne: brak danych, błąd importu, duplikaty.",
          "Blokady księgowe i schematowe: brak dekretu, brak schematu, schemat błędny.",
          "Blokady podatkowe, KSeF, płatnicze, merytoryczne i zarządcze.",
        ],
        layout: ["Typ blokady", "Dokument", "Kontrahent", "Kwota", "Powód", "Odpowiedzialny", "Status"],
        alerts: ["Dokument bez schematu i bez dekretu.", "Faktura sprzedaży bez KSeF.", "Płatność na rachunek spoza białej listy."],
      },
      {
        key: "documents-action",
        title: "Dokumenty wymagające działania",
        section: "Paczki i zamknięcie",
        summary: "Najważniejszy raport dzienny dla księgowej z priorytetem, problemem i właścicielem czynności.",
        question: "Które dokumenty wymagają natychmiastowego działania i kto powinien je obsłużyć?",
        priority: "Krytyczny",
        queryKey: "documents-action",
        sources: ["Optima", "KSeF", "Bank"],
        filters: ["Okres od-do", "Priorytet", "Odpowiedzialny", "Status księgowy", "Status KSeF"],
        tags: ["operacyjny", "kolejka pracy", "priorytety"],
        primaryModule: "DOCUMENTS",
        relatedModules: ["DOCUMENTS", "LEDGER", "BANK", "SETTLEMENTS"],
        controls: [
          "Priorytet krytyczny.",
          "Priorytet wysoki.",
          "Priorytet średni.",
          "Brak schematu i dekretu.",
          "Brak KSeF.",
          "Płatność nierozpoznana.",
          "Brak MPK.",
          "Brak opisu merytorycznego.",
          "Do obsługi księgowej.",
          "Do rozliczenia płatności.",
          "Do uzupełnienia danych.",
        ],
        layout: ["Priorytet", "Dokument", "Typ", "Kontrahent", "Kwota", "Problem", "Odpowiedzialny", "Status"],
        alerts: ["Brak schematu i dekretu.", "Brak KSeF.", "Płatność nierozpoznana.", "Brak MPK.", "Brak opisu merytorycznego."],
      },
      {
        key: "automation-potential",
        title: "Potencjał automatyzacji",
        section: "Paczki i zamknięcie",
        summary: "Raport wskazujący, na których typach dokumentów księgowość traci najwięcej czasu i gdzie warto budować schematy.",
        question: "Które dokumenty są powtarzalne i powinny wejść do automatyzacji księgowania?",
        priority: "Wysoki",
        sources: ["Optima"],
        filters: ["Okres od-do", "Typ dokumentu", "Kategoria", "Kontrahent", "Status schematu"],
        tags: ["automatyzacja", "efektywność", "schematy"],
        primaryModule: "LEDGER",
        relatedModules: ["LEDGER", "DOCUMENTS", "ACCOUNT_PLAN"],
        controls: [
          "Liczba dokumentów księgowanych ręcznie.",
          "Powtarzalność i możliwość zbudowania schematu.",
          "Priorytet wdrożenia automatyzacji.",
        ],
        layout: ["Typ dokumentu", "Liczba dokumentów", "Ręcznie księgowane", "Powtarzalne", "Można zrobić schemat", "Priorytet"],
        alerts: ["Dużo dokumentów ręcznych mimo powtarzalności.", "Schemat istnieje, ale nie jest używany.", "Wysoki wolumen ręcznych dekretów."],
      },
    ],
  },
  {
    id: "schemes",
    title: "Schematy i dekretacja",
    reports: [
      {
        key: "scheme-completeness",
        title: "Kompletność schematów",
        section: "Schematy i dekretacja",
        summary: "Raport zbiorczy dla sprzedaży, zakupów, banku, kasy, magazynu, środków trwałych i płac.",
        question: "W których obszarach dokumenty mają schemat i dekret, a gdzie proces się urywa?",
        priority: "Krytyczny",
        sources: ["Optima"],
        filters: ["Okres od-do", "Obszar", "Status schematu", "Status dekretu"],
        tags: ["schematy", "kompletność", "dekretacja"],
        primaryModule: "LEDGER",
        relatedModules: ["LEDGER", "DOCUMENTS", "ACCOUNT_PLAN"],
        controls: [
          "Dokumenty ze schematem i bez schematu.",
          "Dokumenty z dekretem i bez dekretu.",
          "Dokumenty oznaczone do weryfikacji.",
        ],
        layout: ["Obszar", "Liczba dokumentów", "Ze schematem", "Bez schematu", "Z dekretem", "Bez dekretu", "Do weryfikacji"],
        alerts: ["Wysoki udział dokumentów bez schematu.", "Schematy nie działają dla całego obszaru.", "Dekretacja nie zamyka obiegu."],
      },
      {
        key: "documents-without-scheme",
        title: "Dokumenty bez schematu",
        section: "Schematy i dekretacja",
        summary: "Lista dokumentów, dla których nie udało się przypisać schematu oraz przyczyna braku schematu.",
        question: "Które dokumenty nie weszły do automatu i dlaczego?",
        priority: "Krytyczny",
        queryKey: "documents-without-scheme",
        sources: ["Optima"],
        filters: ["Okres od-do", "Typ dokumentu", "Kategoria", "Kontrahent", "Powód braku schematu"],
        tags: ["brak schematu", "obsługa ręczna", "powód"],
        primaryModule: "DOCUMENTS",
        relatedModules: ["DOCUMENTS", "LEDGER", "ACCOUNT_PLAN"],
        controls: [
          "Brak kategorii.",
          "Brak kontrahenta.",
          "Brak stawki VAT.",
          "Brak MPK.",
          "Brak projektu.",
          "Nietypowy typ dokumentu.",
          "Korekta.",
          "Dokument walutowy.",
          "Środek trwały.",
          "Brak wynika z danych.",
          "Brak wynika z konfiguracji schematu.",
        ],
        layout: ["Numer dokumentu", "Numer obcy", "Tytuł", "Dotyczy", "Data dokumentu", "Status", "Typ", "Liczba plików", "Optima DoNID"],
        alerts: [
          "Brak kategorii.",
          "Brak kontrahenta.",
          "Brak MPK.",
          "Brak stawki VAT.",
          "Nietypowy typ dokumentu.",
          "Korekta.",
          "Dokument walutowy.",
          "Środek trwały.",
          "Brak wynika z danych.",
          "Brak wynika z konfiguracji schematu.",
        ],
      },
      {
        key: "scheme-without-entry",
        title: "Schemat ze wskazaniem, ale bez dekretu",
        section: "Schematy i dekretacja",
        summary: "Lista dokumentów mających schemat, ale bez wygenerowanego dekretu.",
        question: "Dlaczego schemat jest przypisany, ale nie wygenerował księgowania?",
        priority: "Krytyczny",
        queryKey: "scheme-without-entry",
        sources: ["Optima"],
        filters: ["Okres od-do", "Typ dokumentu", "Schemat", "Status księgowy", "Status schematu"],
        tags: ["schemat bez dekretu", "błąd procesu", "dekretacja"],
        primaryModule: "LEDGER",
        relatedModules: ["LEDGER", "DOCUMENTS", "ACCOUNT_PLAN"],
        controls: [
          "Schemat nieaktywny lub nieuruchomiony.",
          "Brak konta księgowego, konta VAT, konta rozrachunkowego lub kategorii.",
          "Dokument w buforze, niezatwierdzony lub poza warunkami schematu.",
        ],
        layout: ["Data", "Typ", "Numer", "Kontrahent", "Schemat", "Brutto", "Status", "Możliwa przyczyna"],
        alerts: ["Schemat nieaktywny.", "Brak konta VAT.", "Brak konta rozrachunkowego."],
      },
      {
        key: "manual-entries",
        title: "Dokumenty z dekretem, ale bez schematu",
        section: "Schematy i dekretacja",
        summary: "Raport ręcznych księgowań, pokazujący gdzie automatyzacja nie działa lub jest obchodzona.",
        question: "Które dokumenty są księgowane ręcznie mimo możliwości automatyzacji?",
        priority: "Wysoki",
        queryKey: "manual-entries",
        sources: ["Optima"],
        filters: ["Okres od-do", "Osoba księgująca", "Typ dokumentu", "Kwota od-do"],
        tags: ["dekret ręczny", "kontrola ręczna", "automatyzacja"],
        primaryModule: "LEDGER",
        relatedModules: ["LEDGER", "DOCUMENTS"],
        controls: [
          "Dekrety ręczne na istotne kwoty.",
          "Powtarzalne dokumenty księgowane ręcznie.",
          "Osoba księgująca i uwagi do dekretu.",
        ],
        layout: ["Data", "Typ", "Numer", "Kontrahent", "Brutto", "Konto Wn", "Konto Ma", "Osoba księgująca", "Uwagi"],
        alerts: ["Dużo ręcznych dekretów.", "Ręczne księgowanie na istotną kwotę.", "Powtarzalny typ dokumentu bez schematu."],
      },
      {
        key: "entry-consistency",
        title: "Zgodność dekretacji",
        section: "Schematy i dekretacja",
        summary: "Kontrola równowagi Wn/Ma, zgodności z brutto, VAT, kontem kosztowym lub przychodowym oraz okresem księgowania.",
        question: "Czy wygenerowany dekret jest poprawny księgowo i zgodny z dokumentem?",
        priority: "Krytyczny",
        sources: ["Optima"],
        filters: ["Okres od-do", "Typ dokumentu", "Status księgowy", "Konto księgowe"],
        tags: ["zgodność dekretu", "Wn/Ma", "kontrola księgowa"],
        primaryModule: "LEDGER",
        relatedModules: ["LEDGER", "DOCUMENTS", "VAT_PURCHASE", "VAT_SALE"],
        controls: [
          "Równowaga dekretu: suma Wn równa się suma Ma.",
          "Rozrachunki zgodne z brutto, konto VAT zgodne z kwotą VAT.",
          "Data księgowania w prawidłowym miesiącu.",
        ],
        layout: ["Dokument", "Brutto dokumentu", "Suma Wn", "Suma Ma", "Różnica", "Status"],
        alerts: ["Dekret niezbilansowany.", "VAT w dekrecie nie zgadza się z VAT dokumentu.", "Data księgowania poza okresem."],
      },
      {
        key: "scheme-usage",
        title: "Użycie i nieużywane schematy",
        section: "Schematy i dekretacja",
        summary: "Zestawienie aktywnych schematów, liczby użyć, kwot oraz schematów nieużywanych lub błędnych.",
        question: "Które schematy faktycznie pracują, a które należy poprawić lub zarchiwizować?",
        priority: "Wysoki",
        sources: ["Optima"],
        filters: ["Okres od-do", "Typ dokumentu", "Schemat", "Status aktywności"],
        tags: ["użycie schematów", "archiwizacja", "konfiguracja"],
        primaryModule: "ACCOUNT_PLAN",
        relatedModules: ["ACCOUNT_PLAN", "LEDGER", "DOCUMENTS"],
        controls: [
          "Liczba użyć i wartości netto, VAT oraz brutto.",
          "Ostatnie użycie schematu i użycia w okresie.",
          "Schemat aktywny bez użycia oraz schemat istniejący, ale omijany ręcznie.",
        ],
        layout: ["Schemat", "Typ dokumentu", "Liczba użyć", "Ostatnie użycie", "Status", "Błędy"],
        alerts: ["Schemat nigdy nieużyty.", "Schemat aktywny bez użycia.", "Schemat istnieje, ale dokumenty idą ręcznie."],
      },
    ],
  },
  {
    id: "sales",
    title: "Sprzedaż",
    reports: [
      {
        key: "sales-vat-register",
        title: "Rejestr sprzedaży VAT",
        section: "Sprzedaż",
        summary: "Raport sprzedaży dla VAT należnego, kontroli stawek i zgodności z KSeF.",
        question: "Czy cała sprzedaż jest ujęta poprawnie podatkowo i formalnie?",
        priority: "Krytyczny",
        sources: ["Optima", "KSeF"],
        filters: ["Okres od-do", "Typ daty", "Kontrahent", "Status KSeF", "Status płatności"],
        tags: ["sprzedaż", "VAT należny", "KSeF"],
        primaryModule: "VAT_SALE",
        relatedModules: ["VAT_SALE", "DOCUMENTS", "SETTLEMENTS"],
        controls: [
          "Sprzedaż według kontrahentów, produktów i miesięcy.",
          "Faktury bez KSeF lub bez księgowania.",
          "Korekty, anulacje i stawki nietypowe 0%, zw., NP.",
        ],
        layout: ["Data", "Numer", "Kontrahent", "Netto", "VAT", "Brutto", "Stawka VAT", "Status KSeF"],
        alerts: ["Faktura sprzedaży bez KSeF.", "Korekta bez faktury pierwotnej.", "Faktura anulowana zaksięgowana."],
      },
      {
        key: "sales-unpaid",
        title: "Sprzedaż nieopłacona",
        section: "Sprzedaż",
        summary: "Raport należności ze sprzedaży z podziałem na terminy, przeterminowania i powiązania z rozrachunkami.",
        question: "Które faktury sprzedaży nie zostały opłacone i wymagają reakcji?",
        priority: "Wysoki",
        sources: ["Optima", "Bank"],
        filters: ["Okres od-do", "Kontrahent", "Status płatności", "Kwota od-do"],
        tags: ["sprzedaż", "należności", "windykacja"],
        primaryModule: "SETTLEMENTS",
        relatedModules: ["SETTLEMENTS", "VAT_SALE", "BANK"],
        controls: [
          "Faktury niezapłacone i częściowo zapłacone.",
          "Struktura wiekowa należności.",
          "Nadpłaty, niedopłaty i płatności nierozliczone.",
        ],
        layout: ["Numer dokumentu", "Kontrahent", "Brutto", "Termin płatności", "Kwota otwarta", "Status płatności", "Dni po terminie"],
        alerts: ["Faktura przeterminowana.", "Nadpłata klienta.", "Płatność rozliczona bez faktury."],
      },
      {
        key: "sales-ksef-gap",
        title: "Sprzedaż bez KSeF",
        section: "Sprzedaż",
        summary: "Raport ryzyka formalnego dla sprzedaży niewysłanej do KSeF albo niepowiązanej z numerem KSeF.",
        question: "Które dokumenty sprzedażowe są w księgach, ale nie mają potwierdzenia KSeF?",
        priority: "Krytyczny",
        sources: ["Optima", "KSeF"],
        filters: ["Okres od-do", "Typ dokumentu", "Status KSeF", "Kontrahent"],
        tags: ["sprzedaż", "KSeF", "ryzyko formalne"],
        primaryModule: "VAT_SALE",
        relatedModules: ["VAT_SALE", "DOCUMENTS"],
        controls: [
          "Faktura w KSeF, brak w księgach.",
          "Faktura w księgach, brak w KSeF.",
          "Luki numeracji i dokumenty odrzucone.",
        ],
        layout: ["Numer", "Kontrahent", "Data wystawienia", "Status KSeF", "Data księgowania", "Powód"],
        alerts: ["Faktura sprzedaży niewysłana.", "Status odrzucony.", "Brak numeru KSeF."],
      },
    ],
  },
  {
    id: "purchases",
    title: "Zakupy i koszty",
    reports: [
      {
        key: "purchase-vat-register",
        title: "Rejestr zakupów VAT",
        section: "Zakupy i koszty",
        summary: "Raport zakupów dla VAT naliczonego, praw do odliczenia, ograniczeń podatkowych i KSeF.",
        question: "Czy wszystkie faktury zakupowe są ujęte prawidłowo jako koszt i VAT?",
        priority: "Krytyczny",
        sources: ["Optima", "KSeF", "OCR"],
        filters: ["Okres od-do", "Kontrahent", "Status VAT", "Kategoria", "MPK"],
        tags: ["zakupy", "VAT naliczony", "koszty"],
        primaryModule: "VAT_PURCHASE",
        relatedModules: ["VAT_PURCHASE", "DOCUMENTS", "SETTLEMENTS"],
        controls: [
          "Faktury bez opisu, bez MPK i bez schematu.",
          "Faktury z ograniczonym VAT i bez prawa do odliczenia.",
          "Faktury inwestycyjne oraz KSeF niezaksięgowane.",
        ],
        layout: ["Data wpływu", "Numer", "Dostawca", "Netto", "VAT", "Brutto", "Kategoria", "MPK", "Status VAT"],
        alerts: ["Brak prawa do VAT.", "Faktura z KSeF bez księgowania.", "Brak MPK lub projektu."],
      },
      {
        key: "purchases-without-scheme",
        title: "Faktury bez schematu lub dekretu",
        section: "Zakupy i koszty",
        summary: "Raport kompletności księgowej zakupów z naciskiem na braki automatyzacji.",
        question: "Które zakupy wymagają ręcznej obsługi lub nie zostały zaksięgowane?",
        priority: "Krytyczny",
        sources: ["Optima"],
        filters: ["Okres od-do", "Dostawca", "Status schematu", "Status księgowy", "Kategoria"],
        tags: ["zakupy", "brak schematu", "brak dekretu"],
        primaryModule: "DOCUMENTS",
        relatedModules: ["DOCUMENTS", "LEDGER", "VAT_PURCHASE"],
        controls: [
          "Brak schematu i brak dekretu dla faktur kosztowych.",
          "VAT bez konta VAT oraz koszt bez konta kosztowego.",
          "Faktury bez akceptacji lub bez MPK.",
        ],
        layout: ["Data", "Numer", "Dostawca", "Brutto", "Kategoria", "Status schematu", "Status księgowy", "Powód"],
        alerts: ["Brak schematu.", "Brak dekretu.", "Koszt bez konta kosztowego."],
      },
      {
        key: "costs-by-dimension",
        title: "Koszty według kategorii, MPK i projektów",
        section: "Zakupy i koszty",
        summary: "Raport controllingowy dla kosztów z podziałem na kategorie, MPK, projekty i dostawców.",
        question: "Jak rozkładają się koszty i gdzie brakuje danych do controllingu?",
        priority: "Wysoki",
        sources: ["Optima"],
        filters: ["Okres od-do", "Kategoria", "MPK", "Projekt", "Dostawca", "Kwota od-do"],
        tags: ["koszty", "controlling", "MPK"],
        primaryModule: "VAT_PURCHASE",
        relatedModules: ["VAT_PURCHASE", "LEDGER", "DOCUMENTS"],
        controls: [
          "Koszty według kategorii i dostawców.",
          "Braki MPK, projektu lub opisu merytorycznego.",
          "Koszty nietypowe dla kontrahenta i duże wzrosty miesiąc do miesiąca.",
        ],
        layout: ["Kategoria", "MPK", "Projekt", "Dostawca", "Netto", "VAT nieodliczony", "Status opisu"],
        alerts: ["Brak MPK.", "Brak projektu.", "Duży wzrost kosztu miesiąc do miesiąca."],
      },
    ],
  },
  {
    id: "vat",
    title: "VAT i JPK",
    reports: [
      {
        key: "vat-summary",
        title: "Podsumowanie VAT",
        section: "VAT i JPK",
        summary: "Raport deklaracyjny łączący VAT należny, naliczony, przeniesienia i odwrotne obciążenia.",
        question: "Jakie jest końcowe rozliczenie VAT i z czego wynika?",
        priority: "Krytyczny",
        sources: ["Optima", "JPK"],
        filters: ["Okres od-do", "Stawka VAT", "Status VAT", "Kontrahent", "Typ dokumentu"],
        tags: ["VAT", "deklaracja", "JPK"],
        primaryModule: "JPK_DECLARATIONS",
        relatedModules: ["JPK_DECLARATIONS", "VAT_PURCHASE", "VAT_SALE"],
        controls: [
          "VAT należny, naliczony i do przeniesienia.",
          "VAT z importu usług, WNT i odwrotne rozliczenia.",
          "Raport wyjątków VAT z ręczną kontrolą.",
        ],
        layout: ["Sekcja deklaracji", "Kwota", "Źródło", "Status", "Uwagi"],
        alerts: ["VAT z rejestru nie zgadza się z VAT z JPK.", "Stawka nietypowa.", "VAT nieodliczony bez opisu."],
      },
      {
        key: "vat-exceptions",
        title: "Raport wyjątków VAT",
        section: "VAT i JPK",
        summary: "Lista dokumentów wymagających kontroli podatkowej z perspektywy stawek, podstaw i kont VAT.",
        question: "Które dokumenty VAT wymagają ręcznej weryfikacji przed zamknięciem?",
        priority: "Krytyczny",
        sources: ["Optima", "JPK", "KSeF"],
        filters: ["Okres od-do", "Stawka VAT", "Status KSeF", "Kwota od-do"],
        tags: ["VAT", "wyjątki", "ryzyko podatkowe"],
        primaryModule: "VAT_PURCHASE",
        relatedModules: ["VAT_PURCHASE", "VAT_SALE", "LEDGER"],
        controls: [
          "VAT 0% bez podstawy i VAT zw. bez podstawy.",
          "Konto VAT bez kwoty VAT albo kwota VAT bez konta VAT.",
          "Korekty VAT w złym okresie.",
        ],
        layout: ["Dokument", "Kontrahent", "Stawka VAT", "Kwota VAT", "Problem", "Rekomendacja"],
        alerts: ["VAT 0% bez podstawy.", "Konto VAT bez kwoty VAT.", "Korekta VAT w złym okresie."],
      },
      {
        key: "jpk-reconciliation",
        title: "JPK vs rejestry i księgi",
        section: "VAT i JPK",
        summary: "Raport zgodności między JPK, rejestrami VAT, dekretami i dokumentami.",
        question: "Czy JPK da się uzasadnić danymi źródłowymi i księgowymi?",
        priority: "Krytyczny",
        sources: ["Optima", "JPK"],
        filters: ["Okres od-do", "Źródło danych", "Status VAT", "Typ dokumentu"],
        tags: ["JPK", "uzgodnienie", "zgodność"],
        primaryModule: "JPK_DECLARATIONS",
        relatedModules: ["JPK_DECLARATIONS", "VAT_PURCHASE", "VAT_SALE", "LEDGER"],
        controls: [
          "VAT z rejestru równa się VAT z JPK.",
          "VAT z dokumentów równa się VAT z dekretów.",
          "Rozbieżności między źródłem, rejestrem i księgą.",
        ],
        layout: ["Obszar", "Kwota z JPK", "Kwota z rejestru", "Kwota z księgi", "Różnica", "Status"],
        alerts: ["Rozbieżność JPK vs rejestr.", "Rozbieżność dokument vs dekret.", "Brak źródła dla pozycji JPK."],
      },
    ],
  },
  {
    id: "ksef",
    title: "KSeF",
    reports: [
      {
        key: "ksef-status",
        title: "Faktury KSeF i statusy",
        section: "KSeF",
        summary: "Raport statusów wysyłki i pobrania dokumentów KSeF dla sprzedaży i zakupów.",
        question: "Czy dokumenty KSeF zostały poprawnie wysłane, przyjęte albo pobrane?",
        priority: "Krytyczny",
        sources: ["KSeF", "Optima"],
        filters: ["Okres od-do", "Status KSeF", "Typ dokumentu", "Kontrahent"],
        tags: ["KSeF", "statusy", "formalności"],
        primaryModule: "DOCUMENTS",
        relatedModules: ["DOCUMENTS", "VAT_SALE", "VAT_PURCHASE"],
        controls: [
          "Faktury sprzedaży wysłane i odrzucone.",
          "Faktury zakupowe pobrane i niezaksięgowane.",
          "Duplikaty numeru KSeF i dokumenty bez numeru.",
        ],
        layout: ["Numer dokumentu", "Numer KSeF", "Typ", "Kontrahent", "Status KSeF", "Data KSeF", "Data księgowania"],
        alerts: ["Numer KSeF pusty.", "Status odrzucony.", "Duplikat numeru KSeF."],
      },
      {
        key: "ksef-vs-books",
        title: "KSeF vs księgi",
        section: "KSeF",
        summary: "Kontrola zgodności między dokumentami w KSeF i księgach oraz okresem księgowania.",
        question: "Czy wszystkie dokumenty z KSeF są ujęte w księgach i w prawidłowym okresie?",
        priority: "Krytyczny",
        sources: ["KSeF", "Optima"],
        filters: ["Okres od-do", "Status KSeF", "Status księgowy", "Typ daty"],
        tags: ["KSeF", "księgi", "zgodność"],
        primaryModule: "VAT_PURCHASE",
        relatedModules: ["VAT_PURCHASE", "VAT_SALE", "LEDGER", "DOCUMENTS"],
        controls: [
          "XML KSeF bez księgowania.",
          "Księgowanie bez XML KSeF.",
          "Data KSeF kontra data księgowania.",
        ],
        layout: ["Dokument", "Numer KSeF", "Data KSeF", "Data księgowania", "Status księgowy", "Różnica"],
        alerts: ["XML KSeF bez księgowania.", "Księgowanie bez XML KSeF.", "Data KSeF vs data księgowania."],
      },
      {
        key: "ksef-approvals",
        title: "KSeF i akceptacja obiegu",
        section: "KSeF",
        summary: "Raport łączący formalny status KSeF z akceptacją dokumentu i blokadą księgowania.",
        question: "Czy dokument z KSeF ma pełną akceptację i może być księgowany?",
        priority: "Wysoki",
        sources: ["KSeF", "Obieg dokumentów", "Optima"],
        filters: ["Okres od-do", "Status KSeF", "Osoba akceptująca", "Status księgowy"],
        tags: ["KSeF", "akceptacja", "obieg"],
        primaryModule: "DOCUMENTS",
        relatedModules: ["DOCUMENTS", "VAT_PURCHASE"],
        controls: [
          "Faktury bez akceptacji.",
          "Faktury zakupowe pobrane z KSeF, ale zablokowane w obiegu.",
          "Data akceptacji i osoba akceptująca.",
        ],
        layout: ["Dokument", "Numer KSeF", "Status KSeF", "Status akceptacji", "Osoba akceptująca", "Data akceptacji"],
        alerts: ["Faktura zakupowa bez akceptacji.", "Brak osoby akceptującej.", "Dokument pobrany, ale zablokowany."],
      },
    ],
  },
  {
    id: "bank",
    title: "Bank i rozrachunki",
    reports: [
      {
        key: "bank-statement",
        title: "Wyciąg bankowy i integralność",
        section: "Bank i rozrachunki",
        summary: "Raport podstawowy dla operacji bankowych, sald i dekretacji wyciągów.",
        question: "Czy wyciąg bankowy jest kompletny i poprawnie zaksięgowany?",
        priority: "Krytyczny",
        sources: ["Bank", "Optima"],
        filters: ["Okres od-do", "Konto bankowe", "Waluta", "Status księgowy"],
        tags: ["bank", "wyciąg", "integralność"],
        primaryModule: "BANK",
        relatedModules: ["BANK", "LEDGER"],
        controls: [
          "Saldo początkowe plus obroty równa się saldo końcowe.",
          "Prowizje bankowe i operacje bez schematu.",
          "Bank bez dekretu i operacje walutowe bez kursu.",
        ],
        layout: ["Data", "Opis operacji", "Wpływ", "Wydatek", "Saldo", "Waluta", "Status księgowy"],
        alerts: ["Saldo banku niezgodne z wyciągiem.", "Operacja walutowa bez kursu.", "Bank bez dekretu."],
      },
      {
        key: "unidentified-payments",
        title: "Płatności nierozpoznane",
        section: "Bank i rozrachunki",
        summary: "Raport płatności bez dokumentów, płatności rozliczonych bez faktury oraz przelewów do kontroli podatkowej.",
        question: "Które przepływy bankowe nie mają wiarygodnego dokumentu źródłowego?",
        priority: "Wysoki",
        sources: ["Bank", "Optima"],
        filters: ["Okres od-do", "Kontrahent", "Waluta", "Kwota od-do"],
        tags: ["bank", "nierozpoznane", "kontrola podatkowa"],
        primaryModule: "BANK",
        relatedModules: ["BANK", "SETTLEMENTS", "DOCUMENTS"],
        controls: [
          "Płatność bez faktury oraz faktura bez płatności.",
          "Nadpłaty, niedopłaty i płatności częściowe.",
          "Biała lista, MPP i przelewy do właściciela lub zarządu.",
        ],
        layout: ["Data", "Kontrahent", "Opis przelewu", "Kwota", "Powiązany dokument", "Problem", "Rekomendacja"],
        alerts: ["Płatność bez faktury.", "Brak MPP.", "Rachunek spoza białej listy."],
      },
      {
        key: "settlements-aging",
        title: "Należności, zobowiązania i struktura wiekowa",
        section: "Bank i rozrachunki",
        summary: "Raport rozrachunków dla należności, zobowiązań, kompensat i starych sald.",
        question: "Jak wyglądają otwarte rozrachunki i które salda wymagają uzgodnienia?",
        priority: "Wysoki",
        sources: ["Optima", "Bank"],
        filters: ["Okres od-do", "Kontrahent", "Status płatności", "Kwota od-do"],
        tags: ["rozrachunki", "struktura wiekowa", "salda"],
        primaryModule: "SETTLEMENTS",
        relatedModules: ["SETTLEMENTS", "BANK", "LEDGER"],
        controls: [
          "Saldo konta 201 i 202 kontra rozrachunki.",
          "Faktura zapłacona, ale nierozliczona.",
          "Salda starsze niż 90 lub 180 dni oraz rozrachunki z powiązanymi.",
        ],
        layout: ["Kontrahent", "Typ rozrachunku", "Kwota", "Termin", "Dni po terminie", "Status płatności", "Saldo"],
        alerts: ["Stare należności.", "Stare zobowiązania.", "Ujemne saldo kontrahenta."],
      },
    ],
  },
  {
    id: "assets",
    title: "Magazyn i majątek",
    reports: [
      {
        key: "warehouse-reconciliation",
        title: "Magazyn vs księga",
        section: "Magazyn i majątek",
        summary: "Raport stanów, ruchów magazynowych i ich zgodności z dokumentami źródłowymi oraz księgą.",
        question: "Czy magazyn jest spójny ze sprzedażą, zakupami i księgą główną?",
        priority: "Wysoki",
        sources: ["Optima", "Magazyn"],
        filters: ["Okres od-do", "Magazyn", "Indeks", "Typ dokumentu"],
        tags: ["magazyn", "uzgodnienie", "stany"],
        primaryModule: "DOCUMENTS",
        relatedModules: ["DOCUMENTS", "LEDGER"],
        controls: [
          "WZ bez faktury sprzedaży i PZ bez faktury zakupu.",
          "Stany ujemne, brak ceny i brak indeksu.",
          "Różnice inwentaryzacyjne bez dekretu.",
        ],
        layout: ["Magazyn", "Indeks", "Dokument", "Ilość", "Wartość", "Powiązanie księgowe", "Status"],
        alerts: ["Stan ujemny.", "WZ bez FS.", "PZ bez FZ."],
      },
      {
        key: "fixed-assets-register",
        title: "Środki trwałe i amortyzacja",
        section: "Magazyn i majątek",
        summary: "Raport ewidencji środków trwałych, amortyzacji, OT, LT i inwestycji w toku.",
        question: "Czy majątek trwały jest prawidłowo wprowadzony, amortyzowany i rozliczony?",
        priority: "Wysoki",
        sources: ["Optima"],
        filters: ["Okres od-do", "Typ dokumentu", "KŚT", "Status środka trwałego"],
        tags: ["środki trwałe", "amortyzacja", "inwestycje"],
        primaryModule: "FIXED_ASSETS",
        relatedModules: ["FIXED_ASSETS", "VAT_PURCHASE", "LEDGER"],
        controls: [
          "Faktura inwestycyjna bez OT i OT bez faktury.",
          "Środek trwały bez KŚT lub stawki amortyzacji.",
          "Amortyzacja po likwidacji i konto 080 bez rozliczenia.",
        ],
        layout: ["Numer środka trwałego", "Nazwa", "Data OT", "Wartość początkowa", "Stawka amortyzacji", "Status", "Powiązanie faktury"],
        alerts: ["Środek trwały bez stawki amortyzacji.", "Konto 080 bez rozliczenia.", "Zakup środka trwałego w kosztach bieżących."],
      },
    ],
  },
  {
    id: "payroll",
    title: "Kadry i płace",
    reports: [
      {
        key: "payroll-list",
        title: "Lista płac i przelewy",
        section: "Kadry i płace",
        summary: "Raport wynagrodzeń z porównaniem list płac, przelewów oraz rozliczeń publicznoprawnych.",
        question: "Czy wynagrodzenia, przelewy i zobowiązania ZUS/PIT są zgodne?",
        priority: "Wysoki",
        sources: ["Optima", "Bank"],
        filters: ["Okres od-do", "Pracownik", "MPK", "Projekt", "Status płatności"],
        tags: ["płace", "przelewy", "ZUS", "PIT"],
        primaryModule: "HR_PAYROLL",
        relatedModules: ["HR_PAYROLL", "BANK", "LEDGER"],
        controls: [
          "Lista płac kontra przelewy pracownicze.",
          "Lista płac kontra ZUS, PIT i PPK.",
          "Nieobecności, umowy po terminie i przelewy wynagrodzeń.",
        ],
        layout: ["Pracownik", "Wynagrodzenie brutto", "Koszt pracodawcy", "Przelew", "ZUS", "PIT", "Status"],
        alerts: ["Lista płac nie zgadza się z przelewami.", "ZUS lub PIT po terminie.", "Nieobecność bez rozliczenia."],
      },
      {
        key: "payroll-allocation",
        title: "Wynagrodzenia według MPK i projektów",
        section: "Kadry i płace",
        summary: "Raport controllingowy dla kosztu pracodawcy i alokacji płac do MPK, projektów i ewidencji czasu.",
        question: "Czy koszty wynagrodzeń są prawidłowo przypisane do controllingu i projektów?",
        priority: "Wysoki",
        sources: ["Optima", "HR"],
        filters: ["Okres od-do", "MPK", "Projekt", "Pracownik", "Dział"],
        tags: ["płace", "MPK", "projekty", "B+R"],
        primaryModule: "HR_PAYROLL",
        relatedModules: ["HR_PAYROLL", "LEDGER"],
        controls: [
          "Pracownik bez MPK lub bez projektu.",
          "Wynagrodzenie bez ewidencji czasu.",
          "Koszt pracodawcy według MPK i projektów.",
        ],
        layout: ["Pracownik", "MPK", "Projekt", "Koszt pracodawcy", "Czas pracy", "Status alokacji"],
        alerts: ["Pracownik bez MPK.", "Pracownik bez projektu.", "Brak ewidencji czasu."],
      },
    ],
  },
  {
    id: "projects",
    title: "Projekty / MPK / B+R",
    reports: [
      {
        key: "construction-site-costs",
        title: "Koszty i dokumenty według budów 500-150",
        section: "Projekty / MPK / B+R",
        summary: "Raport budów oparty o dekrety na kontach 500-150. Pokazuje dokumenty, kontrahentów, opisy kosztów i kwoty przypisane do wybranych miejsc realizacji usług.",
        question: "Jakie dokumenty i koszty są przypisane do zaznaczonych budów z kont 500-150?",
        priority: "Wysoki",
        queryKey: "construction-site-costs",
        sources: ["Optima", "Księga"],
        filters: ["Okres od-do", "Budowa", "Kontrahent", "Typ dokumentu", "Kwota od-do"],
        tags: ["budowy", "500-150", "koszty realizacji"],
        primaryModule: "LEDGER",
        relatedModules: ["LEDGER", "ACCOUNT_PLAN", "DOCUMENTS"],
        controls: [
          "Koszty z dekretów, gdzie budowa jest przypięta do konta 500-150.",
          "Dokumenty i opisy kosztów przypisane do wskazanych budów.",
          "Szybkie zawężenie raportu do jednej lub wielu budów oraz eksport wyników.",
        ],
        layout: ["Budowa", "Konto budowy", "Data", "Dokument", "Typ dokumentu", "Kontrahent", "Kwota", "Opis kosztu", "Status księgowy"],
        alerts: ["Koszt bez opisu na budowie.", "Nietypowy dokument na budowie.", "Wysoki koszt wymagający weryfikacji."],
      },
      {
        key: "project-costs",
        title: "Koszty według projektów i zadań",
        section: "Projekty / MPK / B+R",
        summary: "Raport projektowy dla controllingu, budżetu, kwalifikowalności i dokumentów bez projektu.",
        question: "Czy koszty projektowe są kompletne i przypisane do właściwych zadań?",
        priority: "Wysoki",
        sources: ["Optima", "HR", "Obieg dokumentów"],
        filters: ["Okres od-do", "Projekt", "Zadanie", "MPK", "Status księgowy"],
        tags: ["projekty", "budżet", "kwalifikowalność"],
        primaryModule: "VAT_PURCHASE",
        relatedModules: ["VAT_PURCHASE", "LEDGER", "HR_PAYROLL", "DOCUMENTS"],
        controls: [
          "Koszty według projektów i zadań.",
          "Dokumenty bez projektu oraz koszty poza okresem projektu.",
          "Koszty kwalifikowane i niekwalifikowane.",
        ],
        layout: ["Projekt", "Zadanie", "Dokument", "Kwota", "Status kwalifikowalności", "Budżet", "Wykonanie"],
        alerts: ["Faktura bez projektu.", "Koszt poza okresem projektu.", "Koszt przekracza budżet."],
      },
      {
        key: "br-research",
        title: "Koszty kwalifikowane B+R",
        section: "Projekty / MPK / B+R",
        summary: "Raport B+R dla kosztów kwalifikowanych, wyłączeń, ewidencji czasu i ryzyk podatkowych.",
        question: "Czy koszty B+R są udokumentowane i podatkowo obronne?",
        priority: "Wysoki",
        sources: ["Optima", "HR", "Projekt"],
        filters: ["Okres od-do", "Projekt", "Rodzaj kosztu", "Pracownik", "Status opisu"],
        tags: ["B+R", "koszty kwalifikowane", "ryzyko podatkowe"],
        primaryModule: "HR_PAYROLL",
        relatedModules: ["HR_PAYROLL", "VAT_PURCHASE", "LEDGER"],
        controls: [
          "Koszt B+R bez opisu.",
          "Wynagrodzenie bez ewidencji czasu.",
          "Podwójne finansowanie i dokument bez źródła.",
        ],
        layout: ["Projekt B+R", "Dokument", "Rodzaj kosztu", "Kwota", "Ewidencja czasu", "Status kwalifikowalności"],
        alerts: ["Koszt B+R bez opisu.", "Wynagrodzenie bez ewidencji czasu.", "Podwójne finansowanie."],
      },
    ],
  },
  {
    id: "contractors",
    title: "Kontrahenci",
    reports: [
      {
        key: "contractor-master",
        title: "Kartoteka kontrahentów",
        section: "Kontrahenci",
        summary: "Raport jakości danych kontrahentów: NIP, adres, kraj, rachunki, status VAT i powiązania.",
        question: "Czy kartoteka kontrahentów jest kompletna i bez ryzyk formalnych?",
        priority: "Wysoki",
        sources: ["Optima"],
        filters: ["Kontrahent", "NIP", "Kraj", "Status VAT", "Powiązanie"],
        tags: ["kontrahenci", "master data", "formalności"],
        primaryModule: "CONTRACTORS",
        relatedModules: ["CONTRACTORS", "SETTLEMENTS", "VAT_PURCHASE", "VAT_SALE"],
        controls: [
          "Brak NIP, kraju, adresu lub statusu powiązania.",
          "Duplikaty kontrahentów i zmiana rachunku bankowego.",
          "Status VAT oraz rachunki spoza białej listy.",
        ],
        layout: ["Kod", "Nazwa", "NIP", "Kraj", "Rachunek bankowy", "Status VAT", "Powiązanie", "Status aktywności"],
        alerts: ["Brak NIP.", "Duplikat kontrahenta.", "Rachunek spoza białej listy."],
      },
      {
        key: "contractor-risks",
        title: "Ryzyka kontrahenta",
        section: "Kontrahenci",
        summary: "Raport kontrahentów wymagających ostrożności podatkowej, rozrachunkowej lub formalnej.",
        question: "Którzy kontrahenci generują największe ryzyka księgowe i podatkowe?",
        priority: "Wysoki",
        sources: ["Optima", "Bank", "VAT"],
        filters: ["Kontrahent", "Status VAT", "Powiązanie", "Kwota od-do"],
        tags: ["kontrahenci", "ryzyko", "białą lista"],
        primaryModule: "CONTRACTORS",
        relatedModules: ["CONTRACTORS", "SETTLEMENTS", "BANK"],
        controls: [
          "Nieaktywny VAT i brak kraju dla kontrahentów zagranicznych.",
          "Rozrachunki z podmiotami powiązanymi.",
          "Zmiana rachunku bankowego i braki adresowe.",
        ],
        layout: ["Kontrahent", "Ryzyko", "Opis", "Źródło", "Kwota ekspozycji", "Rekomendacja"],
        alerts: ["Nieaktywny VAT.", "Brak kraju.", "Zmiana rachunku bankowego."],
      },
    ],
  },
  {
    id: "management",
    title: "Zarząd i controlling",
    reports: [
      {
        key: "management-kpi",
        title: "Wynik, cash flow i KPI",
        section: "Zarząd i controlling",
        summary: "Raport zarządczy dla wyniku, marży, cash flow, należności, zobowiązań i alertów krytycznych.",
        question: "Jakie są główne KPI finansowe i ryzyka operacyjne firmy?",
        priority: "Wysoki",
        sources: ["Optima", "Bank", "VAT", "Rozrachunki"],
        filters: ["Okres od-do", "MPK", "Projekt", "Waluta", "Kwota od-do"],
        tags: ["zarząd", "KPI", "cash flow"],
        primaryModule: "LEDGER",
        relatedModules: ["LEDGER", "BANK", "SETTLEMENTS", "VAT_SALE", "VAT_PURCHASE"],
        controls: [
          "Przychody, koszty, wynik i marża.",
          "Cash flow oraz zobowiązania podatkowe.",
          "Należności, zobowiązania i alerty krytyczne.",
        ],
        layout: ["Obszar", "Wartość bieżąca", "Wartość poprzednia", "Odchylenie", "Komentarz"],
        alerts: ["Duży wzrost kosztu.", "Spadek płynności.", "Wysokie zobowiązania podatkowe."],
      },
      {
        key: "cost-control",
        title: "Budżet vs wykonanie",
        section: "Zarząd i controlling",
        summary: "Raport odchyleń budżetowych dla projektów, MPK, kosztów i przychodów.",
        question: "Gdzie wykonanie odbiega od planu i wymaga reakcji zarządczej?",
        priority: "Wysoki",
        sources: ["Optima", "Controlling"],
        filters: ["Okres od-do", "MPK", "Projekt", "Zadanie", "Kwota od-do"],
        tags: ["budżet", "odchylenia", "controlling"],
        primaryModule: "LEDGER",
        relatedModules: ["LEDGER", "VAT_PURCHASE", "HR_PAYROLL"],
        controls: [
          "Koszty i przychody kontra budżet.",
          "Przekroczenia budżetu według projektu i zadania.",
          "Dokumenty bez MPK lub bez projektu obniżające jakość raportowania.",
        ],
        layout: ["Obszar", "Budżet", "Wykonanie", "Odchylenie", "Status", "Właściciel"],
        alerts: ["Koszt przekracza budżet.", "Brak MPK.", "Brak projektu."],
      },
    ],
  },
];

const REPORTS = REPORT_GROUPS.flatMap((group) =>
  group.reports.map((report) => ({
    ...report,
    queryKey: report.queryKey || report.key,
    groupId: group.id,
    groupTitle: group.title,
  })),
);

const ALL_REPORT_KEYS = REPORTS.map((report) => report.key);
const HERO_STACK_REPORTS = new Set(ALL_REPORT_KEYS);
const REPORTS_BY_KEY = Object.fromEntries(REPORTS.map((report) => [report.key, report]));
const REPORT_GROUPS_BY_ID = Object.fromEntries(REPORT_GROUPS.map((group) => [group.id, group]));
const SIDEBAR_GROUP_IDS = REPORT_GROUPS.map((group) => group.id);
const DATABASE_STORAGE_KEY = "optimaAudit.connectedDatabase";
const FAVORITES_STORAGE_KEY = "optimaAudit.favoriteReports";
const IMPORT_YEARS_STORAGE_KEY = "optimaAudit.importYears";
const SIMPLE_STACK_FILTER_REPORTS = new Set(ALL_REPORT_KEYS);
const EMBEDDED_HEADER_FILTER_REPORTS = new Set(ALL_REPORT_KEYS);
const SELECTION_FILTER_REPORTS = new Set(ALL_REPORT_KEYS);
const EMBEDDED_HEADER_FILTERS = {
  "documents-without-scheme": [
    { header: "Numer dokumentu", filter: "Numer dokumentu", type: "text", placeholder: "Szukaj", headers: ["Numer dokumentu"] },
    { header: "Numer obcy", filter: "Numer obcy", type: "text", placeholder: "Szukaj", headers: ["Numer obcy"] },
    { header: "Tytuł", filter: "Tytuł", type: "text", placeholder: "Szukaj", headers: ["Tytuł"] },
    { header: "Dotyczy", filter: "Dotyczy", type: "text", placeholder: "Szukaj", headers: ["Dotyczy"] },
    { header: "Data dokumentu", filter: "Data dokumentu", type: "date-condition", headers: ["Data dokumentu"] },
    { header: "Status", filter: "Status", type: "select", emptyLabel: "Wszystkie statusy", headers: ["Status"] },
    { header: "Typ", filter: "Typ", type: "select", emptyLabel: "Wszystkie typy", headers: ["Typ"] },
    { header: "Liczba plików", filter: "Liczba plików", type: "number-condition", headers: ["Liczba plików"] },
    { header: "Optima DoNID", filter: "Optima DoNID", type: "text", placeholder: "Szukaj", headers: ["Optima DoNID"] },
  ],
};

function defaultImportYears() {
  return ["2025", "2026"];
}

function normalizeImportYears(years) {
  const tokens = Array.isArray(years) ? years : String(years || "").split(",");
  const normalized = [];
  for (const token of tokens) {
    const value = String(token || "").trim();
    if (!["2025", "2026"].includes(value) || normalized.includes(value)) continue;
    normalized.push(value);
  }
  return normalized.length ? normalized.sort() : defaultImportYears();
}

function restoreImportYears() {
  try {
    const raw = window.localStorage.getItem(IMPORT_YEARS_STORAGE_KEY);
    return normalizeImportYears(raw ? JSON.parse(raw) : defaultImportYears());
  } catch (_error) {
    return defaultImportYears();
  }
}

function persistImportYears(years) {
  try {
    window.localStorage.setItem(IMPORT_YEARS_STORAGE_KEY, JSON.stringify(normalizeImportYears(years)));
  } catch (_error) {
    // Brak localStorage nie blokuje pracy z wybranymi latami w tej sesji.
  }
}

function syncImportYearsState(state, years) {
  state.importYears = normalizeImportYears(years);
  const import2025 = $("#importYear2025");
  const import2026 = $("#importYear2026");
  if (import2025) import2025.checked = state.importYears.includes("2025");
  if (import2026) import2026.checked = state.importYears.includes("2026");
}

function getSelectedImportYears(state) {
  const fromDom = [
    $("#importYear2025")?.checked ? "2025" : "",
    $("#importYear2026")?.checked ? "2026" : "",
  ].filter(Boolean);
  if (fromDom.length) {
    const normalized = normalizeImportYears(fromDom);
    if (state && typeof state === "object") state.importYears = normalized;
    return normalized;
  }
  const normalized = normalizeImportYears(state?.importYears);
  if (state && typeof state === "object") state.importYears = normalized;
  return normalized;
}

function importYearsLabel(years, { compact = false } = {}) {
  const normalized = normalizeImportYears(years);
  if (normalized.length === 1) return normalized[0];
  return compact ? `${normalized[0]}-${normalized[normalized.length - 1]}` : `${normalized[0]} i ${normalized[1]}`;
}

function defaultTimeFilterYear(state) {
  const years = getSelectedImportYears(state);
  if (!years.length) return "";
  const availableYears = (state?.availableYears || []).map((year) => String(year));
  const preferredYears = availableYears.filter((year) => years.includes(year));
  const sourceYears = preferredYears.length ? preferredYears : years;
  return [...sourceYears].sort().at(-1) || years[0] || "";
}

function renderImportYearsMeta(state) {
  const years = getSelectedImportYears(state);
  const message = years.length === 1
    ? `Po podłączeniu program będzie analizował dane tylko z roku ${years[0]}.`
    : `Po podłączeniu program będzie analizował dane z lat ${importYearsLabel(years)}.`;
  const meta = $("#importYearsMeta");
  if (meta) meta.textContent = message;
}

function getAllowedYearsPayload(state) {
  return { allowed_years: getSelectedImportYears(state) };
}

function selectedAdminProfile() {
  const code = $("#adminValidationKind")?.value || ADMIN_EXPORT_PROFILES[0]?.code || "";
  return ADMIN_PROFILES_BY_CODE[code] || ADMIN_EXPORT_PROFILES[0] || null;
}

function adminValidationScopeText() {
  const sqlProfiles = ADMIN_EXPORT_PROFILES
    .filter((profile) => profile.support === "sql")
    .map((profile) => profile.label)
    .join(", ");
  const previewProfiles = ADMIN_EXPORT_PROFILES
    .filter((profile) => profile.support !== "sql")
    .map((profile) => profile.label)
    .join(", ");
  return `Lista oparta na dokumentacji Optimy. Pełna walidacja SQL: ${sqlProfiles}. Parser / podgląd: ${previewProfiles}.`;
}

function adminProfileMetaText(profile) {
  return profile
    ? `${profile.supportLabel}. Formaty: ${profile.formats.join(", ")}. ${profile.description}`
    : "Wybierz typ eksportu z Optimy.";
}

function adminUploadMetaText(state) {
  return state.adminSourceFileName
    ? `Załadowano plik ${state.adminSourceFileName} (${state.adminSourceFormat || "nieznany format"}).`
    : "Najpierw wybierz plik eksportu z Optimy.";
}

function getReportGroupId(reportKey) {
  return REPORTS_BY_KEY[reportKey]?.groupId || "";
}

function isSidebarGroupExpanded(state, groupId) {
  return state.expandedSidebarGroupId === groupId;
}

function populateAdminValidationProfiles() {
  const select = $("#adminValidationKind");
  if (!select) return;
  select.innerHTML = ADMIN_EXPORT_PROFILES.map(
    (profile) => `<option value="${profile.code}">${escapeHtml(profile.label)}</option>`,
  ).join("");
}

function refreshAdminProfileInputs() {
  const profile = selectedAdminProfile();
  const fileInput = $("#adminValidationFile");
  if (!profile || !fileInput) return;
  fileInput.accept = profile.formats.join(",");
}

export function initApp(state) {
  syncImportYearsState(state, restoreImportYears());
  renderYearOptions(state, defaultTimeFilterYear(state));
  populateAdminValidationProfiles();
  refreshAdminProfileInputs();
  state.favoriteReports = restoreFavoriteReports();
  renderSideMenu(state);
  renderStartFavorites(state);
  bindEvents(state);
  renderImportYearsMeta(state);
  updateConnectBackupButtonState(state);
  renderAdministration(state);
  renderActiveReport(state);
  renderReportData(state);
  renderReportActions(state);
  renderOptimaFilter(state);
  renderReportChart(state);
  renderCurrentView(state);
  updateTimeFilterMeta(state);
  updateBadges(state);
  restoreKnownDatabase(state);
}

function bindEvents(state) {
  bindCommunicationEvents(state);
  bindAdministrationEvents(state);
  bindReportEvents(state);
  bindNavigationEvents(state);
}

function bindCommunicationEvents(state) {
  $("#scanBackups").addEventListener("click", () => scanBackups(state));
  $("#connectBackup").addEventListener("click", () => connectBackup(state));
  $("#refreshDataCatalogPanel").addEventListener("click", () => loadAvailableData(state));
  $("#sqlDatabase").addEventListener("change", () => handleDatabaseSelectionChange(state));
  $("#importYear2025").addEventListener("change", () => handleImportYearsChange(state));
  $("#importYear2026").addEventListener("change", () => handleImportYearsChange(state));
  $("#filterYear").addEventListener("focus", () => ensureAvailableYearsLoaded(state));
  $("#filterYear").addEventListener("pointerdown", () => ensureAvailableYearsLoaded(state));
  $("#applyTimeFilter").addEventListener("click", () => applyTimeFilter(state));
  $("#clearTimeFilters").addEventListener("click", () => clearTimeFilters(state));
}

function bindAdministrationEvents(state) {
  $("#adminValidationFile").addEventListener("change", () => loadAdminFile(state));
  $("#adminValidationKind").addEventListener("change", () => resetAdministrationValidationState(state));
  $("#runAdminValidation").addEventListener("click", () => runAdminValidation(state));
  $("#clearAdminValidation").addEventListener("click", () => clearAdminValidation(state));
}

function bindReportEvents(state) {
  $("#refreshReportData").addEventListener("click", () => loadActiveReportData(state));
  $("#toggleFavoriteReport").addEventListener("click", () => toggleFavoriteReport(state));
  $("#toggleReportExportMenu").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleReportToolbarMenu(state, "export");
  });
  $("#toggleReportCustomizeMenu").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleReportToolbarMenu(state, "customize");
  });
  $("#toggleReportOptimaMenu").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleReportToolbarMenu(state, "sql");
  });
  $("#toggleReportChart").addEventListener("click", () => toggleReportChart(state));
  $("#exportExcelTable").addEventListener("click", () => exportActiveReport(state, "xlsx", false));
  $("#exportExcelChart").addEventListener("click", () => exportActiveReport(state, "xlsx", true));
  $("#exportPdfTable").addEventListener("click", () => exportActiveReport(state, "pdf", false));
  $("#exportPdfChart").addEventListener("click", () => exportActiveReport(state, "pdf", true));
  $("#applyReportFilters").addEventListener("click", () => applyReportSpecificFilters(state));
  $("#clearReportFilters").addEventListener("click", () => clearReportSpecificFilters(state));
  $("#reportFilterFields").addEventListener("keydown", (event) => {
    if (event.key === "Enter") applyReportSpecificFilters(state);
  });
  $("#reportFilterFields").addEventListener("change", () => rememberReportFilterValues(state));
  $("#reportFilterFields").addEventListener("click", (event) => {
    if (!event.target.closest("[data-focus-time-filter]")) return;
    $("#filterYear").focus();
    document.querySelector(".topbar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#reportControls").addEventListener("change", () => {
    rememberControlSelections(state);
    applyReportSpecificFilters(state);
  });
  $("#reportAlerts").addEventListener("change", () => {
    rememberAlertSelections(state);
    applyReportSpecificFilters(state);
  });
  $("#reportLayoutList").addEventListener("change", () => {
    rememberColumnVisibility(state);
    $("#reportLayoutList").innerHTML = renderLayoutEditor(state);
    renderReportData(state);
  });
  $("#reportLayoutList").addEventListener("click", (event) => {
    const moveButton = event.target.closest("[data-layout-move]");
    if (!moveButton) return;
    moveReportColumn(state, moveButton.dataset.layoutTarget, moveButton.dataset.layoutMove);
  });
  $("#reportDataHead").addEventListener("change", (event) => {
    if (!event.target.closest("[data-report-filter]")) return;
    applyReportSpecificFilters(state);
  });
  $("#reportDataHead").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !event.target.closest("[data-report-filter]")) return;
    event.preventDefault();
    applyReportSpecificFilters(state);
  });
  $("#reportTableFilterToggle").addEventListener("click", () => clearHeaderFilters(state));
  $("#reportOptimaContent").addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-optima]");
    if (!copyButton) return;
    copyOptimaExpression(copyButton);
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest(".report-toolbar, .report-toolbar-menu")) return;
    closeReportToolbarMenus(state);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeReportToolbarMenus(state);
  });
}

function bindNavigationEvents(state) {
  $("#sideMenu").addEventListener("click", (event) => {
    const viewItem = event.target.closest("[data-view-key]");
    if (viewItem) {
      selectView(state, viewItem.dataset.viewKey);
      return;
    }

    const groupItem = event.target.closest("[data-report-group]");
    if (groupItem) {
      toggleReportGroup(state, groupItem.dataset.reportGroup);
      return;
    }

    const reportItem = event.target.closest("[data-report-key]");
    if (reportItem) selectReport(state, reportItem.dataset.reportKey);
  });
  $("#startFavorites").addEventListener("click", (event) => {
    const favorite = event.target.closest("[data-favorite-report]");
    if (favorite) selectReport(state, favorite.dataset.favoriteReport);
  });
}

async function handleDatabaseSelectionChange(state) {
  persistDatabase($("#sqlDatabase").value.trim());
  updateBadges(state);
  await loadAvailableYears(state);
  await loadAvailableData(state);
  renderAdministration(state);
  renderActiveReport(state);
  await loadActiveReportData(state);
}

function resetAdministrationValidationState(state) {
  state.adminValidationResult = null;
  state.adminValidationError = "";
  if (state.adminValidationStatus === "ready") state.adminValidationStatus = "idle";
  refreshAdminProfileInputs();
  renderAdministration(state);
}

function selectView(state, viewKey) {
  if (viewKey === "report") {
    activateReportView(state, { loadData: true });
    return;
  }

  if (viewKey === "administration") {
    activateAdministrationView(state);
    return;
  }

  activateStaticView(state, viewKey === "communication" ? "communication" : "start");
}

function clonePlainValue(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function emptyInteractiveReportState() {
  return {
    reportChartEnabled: false,
    reportFilterValues: {},
    reportControlSelections: {},
    reportAlertSelections: {},
    reportColumnOrder: [],
    reportHiddenColumns: {},
  };
}

function interactiveReportStateSnapshot(state) {
  return {
    reportChartEnabled: Boolean(state.reportChartEnabled),
    reportFilterValues: clonePlainValue(state.reportFilterValues || {}),
    reportControlSelections: clonePlainValue(state.reportControlSelections || {}),
    reportAlertSelections: clonePlainValue(state.reportAlertSelections || {}),
    reportColumnOrder: clonePlainValue(state.reportColumnOrder || []),
    reportHiddenColumns: clonePlainValue(state.reportHiddenColumns || {}),
  };
}

function saveInteractiveReportState(state, reportKey = state.currentReportKey) {
  if (!reportKey || !REPORTS_BY_KEY[reportKey]) return;
  state.reportInteractiveStates = state.reportInteractiveStates || {};
  state.reportInteractiveStates[reportKey] = interactiveReportStateSnapshot(state);
}

function restoreInteractiveReportState(state, reportKey, { reset = false } = {}) {
  const savedState = !reset ? state.reportInteractiveStates?.[reportKey] : null;
  const nextState = {
    ...emptyInteractiveReportState(),
    ...(savedState ? clonePlainValue(savedState) : {}),
  };
  state.reportChartEnabled = Boolean(nextState.reportChartEnabled);
  state.reportFilterValues = nextState.reportFilterValues || {};
  state.reportControlSelections = nextState.reportControlSelections || {};
  state.reportAlertSelections = nextState.reportAlertSelections || {};
  state.reportColumnOrder = nextState.reportColumnOrder || [];
  state.reportHiddenColumns = nextState.reportHiddenColumns || {};
  state.reportToolbarMenuOpen = "";
  clearOptimaFilterState(state);
}

function selectReport(state, reportKey) {
  if (!REPORTS_BY_KEY[reportKey]) return;
  if (state.currentReportKey && REPORTS_BY_KEY[state.currentReportKey]) {
    saveInteractiveReportState(state, state.currentReportKey);
  }
  state.currentReportKey = reportKey;
  state.expandedSidebarGroupId = getReportGroupId(reportKey);
  restoreInteractiveReportState(state, reportKey);
  clearReportData(state);
  activateReportView(state, { loadData: true });
}

function toggleReportGroup(state, groupId) {
  if (!REPORT_GROUPS_BY_ID[groupId]) return;
  state.expandedSidebarGroupId = isSidebarGroupExpanded(state, groupId) ? "" : groupId;
  renderSideMenu(state);
}

function resetInteractiveReportState(state) {
  restoreInteractiveReportState(state, state.currentReportKey, { reset: true });
}

function activateReportView(state, { loadData = false } = {}) {
  state.currentView = "report";
  state.expandedSidebarGroupId = state.expandedSidebarGroupId || getReportGroupId(state.currentReportKey);
  renderSideMenu(state);
  renderCurrentView(state);
  renderActiveReport(state);
  updateBadges(state);
  if (loadData) loadActiveReportData(state);
}

function activateAdministrationView(state) {
  state.currentView = "administration";
  renderSideMenu(state);
  renderCurrentView(state);
  renderAdministration(state);
  updateBadges(state);
}

function activateStaticView(state, viewKey) {
  state.currentView = viewKey;
  renderSideMenu(state);
  renderCurrentView(state);
  renderStartFavorites(state);
  updateBadges(state);
}

async function restoreKnownDatabase(state) {
  const restored = await ensureDatabaseAvailable(state);
  if (restored) {
    await loadActiveReportData(state);
    renderAdministration(state);
  }
}

async function ensureDatabaseAvailable(state) {
  if ($("#sqlDatabase").value.trim()) {
    await ensureDatabaseContextLoaded(state);
    return true;
  }
  const storedDatabase = readStoredDatabase();
  const detectedDatabase = storedDatabase || await detectLatestDatabase();
  if (!detectedDatabase || $("#sqlDatabase").value.trim()) return Boolean($("#sqlDatabase").value.trim());

  $("#sqlDatabase").value = detectedDatabase;
  persistDatabase(detectedDatabase);
  setBackupMeta(`Aktywna baza: ${detectedDatabase}.`, "success");
  setBackupInfo({
    tone: "success",
    title: "Baza jest gotowa",
    text: "Aplikacja korzysta z wcześniej podłączonej lokalnej kopii SQL.",
    details: [
      ["Baza", detectedDatabase],
      ["Zakres danych", importYearsLabel(getSelectedImportYears(state))],
      ["Tryb", "Tylko do odczytu"],
    ],
  });
  updateBadges(state);
  await ensureDatabaseContextLoaded(state);
  return true;
}

async function ensureDatabaseContextLoaded(state) {
  const hasYears = (state.availableYears || []).length > 0;
  const hasRenderedYearOptions = $("#filterYear").options.length > 1;
  if (!hasYears || !hasRenderedYearOptions) {
    await loadAvailableYears(state);
  }
  if (!(state.availableData || []).length) {
    await loadAvailableData(state);
  }
  renderAdministration(state);
}

async function detectLatestDatabase() {
  try {
    const response = await fetch("/api/databases");
    const payload = await response.json();
    if (!response.ok || payload.error) return "";
    return payload.databases?.[0]?.name || "";
  } catch (_error) {
    return "";
  }
}

function readStoredDatabase() {
  try {
    return window.localStorage.getItem(DATABASE_STORAGE_KEY) || "";
  } catch (_error) {
    return "";
  }
}

function persistDatabase(databaseName) {
  try {
    if (databaseName) {
      window.localStorage.setItem(DATABASE_STORAGE_KEY, databaseName);
    } else {
      window.localStorage.removeItem(DATABASE_STORAGE_KEY);
    }
  } catch (_error) {
    // Brak localStorage nie blokuje pracy z bazą w tej sesji.
  }
}

function restoreFavoriteReports() {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((key) => REPORTS_BY_KEY[key]) : [];
  } catch (_error) {
    return [];
  }
}

function persistFavoriteReports(favorites) {
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites || []));
  } catch (_error) {
    // Brak localStorage nie blokuje pracy z ulubionymi w tej sesji.
  }
}

function setBackupMeta(message, tone = "neutral") {
  const element = $("#backupMeta");
  element.textContent = message;
  element.classList.remove("is-success", "is-error");
  if (tone === "success") element.classList.add("is-success");
  if (tone === "error") element.classList.add("is-error");
}

function setBackupInfo({ tone = "idle", title, text, details = [] }) {
  const element = $("#backupInfo");
  element.className = `connection-status is-${tone}`;
  const rows = details.length
    ? `<div class="connection-status-grid">${details.map(([label, value]) => `
        <div class="connection-status-row">
          <div class="connection-status-label">${escapeHtml(label)}</div>
          <div class="connection-status-value">${escapeHtml(value)}</div>
        </div>
      `).join("")}</div>`
    : "";
  element.innerHTML = `
    <div class="connection-status-title">${escapeHtml(title)}</div>
    <div class="connection-status-text">${escapeHtml(text)}</div>
    ${rows}
  `;
}

function updateConnectBackupButtonState(state) {
  const path = $("#backupPath").value.trim();
  const hasYears = getSelectedImportYears(state).length > 0;
  $("#connectBackup").disabled = !(path && hasYears);
}

async function handleImportYearsChange(state) {
  const selectedYears = [
    $("#importYear2025")?.checked ? "2025" : "",
    $("#importYear2026")?.checked ? "2026" : "",
  ].filter(Boolean);

  if (!selectedYears.length) {
    syncImportYearsState(state, state.importYears);
    setBackupMeta("Wybierz co najmniej jeden rok do importu.", "error");
    renderImportYearsMeta(state);
    updateConnectBackupButtonState(state);
    return;
  }

  syncImportYearsState(state, selectedYears);
  persistImportYears(state.importYears);
  renderImportYearsMeta(state);
  renderYearOptions(state, defaultTimeFilterYear(state));
  updateTimeFilterMeta(state);
  updateConnectBackupButtonState(state);

  if (!$("#sqlDatabase").value.trim()) {
    renderAdministration(state);
    return;
  }

  await loadAvailableYears(state);
  $("#filterYear").value = defaultTimeFilterYear(state);
  $("#filterMonth").value = defaultMonthValue();
  $("#filterDateFrom").value = "";
  $("#filterDateTo").value = "";
  await applyTimeFilter(state);
}

async function scanBackups(state) {
  const initialPath = $("#backupPath").value.trim() || $("#backupPathDisplay").value.trim();
  $("#backupPath").value = "";
  $("#backupPathDisplay").value = "";
  updateConnectBackupButtonState(state);
  setBackupMeta("Otwieram okno wyboru pliku backupu...");
  setBackupInfo({
    tone: "loading",
    title: "Wybór pliku backupu",
    text: "Za chwilę otworzy się Eksplorator Windows z filtrem dla plików .BAK i .BAC.",
  });
  try {
    const response = await fetch("/api/pick-backup-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initial_path: initialPath,
      }),
    });
    const payload = await readJsonResponse(response, "Nie udało się uruchomić wyboru pliku backupu.");
    if (!response.ok || payload.error) throw new Error(payload.error || "Nie udało się otworzyć wyboru pliku.");
    if (!payload.selected || !payload.path) {
      setBackupMeta("Nie wybrano pliku backupu.");
      setBackupInfo({
        tone: "idle",
        title: "Wybór został anulowany",
        text: "Wskaż plik .BAK lub .BAC, aby przejść do podłączenia lokalnej kopii bazy.",
      });
      return;
    }
    state.backups = [payload];
    selectNewestBackup(state, state.backups);
  } catch (error) {
    setBackupMeta(`Nie udało się wczytać pliku: ${error.message}`, "error");
    setBackupInfo({
      tone: "error",
      title: "Błąd wyboru pliku",
      text: error.message,
    });
  }
}

async function readJsonResponse(response, fallbackMessage) {
  const body = await response.text();
  try {
    return body ? JSON.parse(body) : {};
  } catch (_error) {
    throw new Error(`${fallbackMessage} Zrestartuj lokalny serwer aplikacji i spróbuj ponownie.`);
  }
}

function selectNewestBackup(state, backups) {
  const selected = backups[0];
  if (!selected) {
    $("#backupPathDisplay").value = "";
    $("#backupPath").value = "";
    updateConnectBackupButtonState(state);
    setBackupMeta("Nie znaleziono poprawnego pliku .BAK lub .BAC.", "error");
    setBackupInfo({
      tone: "error",
      title: "Brak pliku backupu",
      text: "Nie udało się wskazać poprawnego pliku do podłączenia.",
    });
    return;
  }
  $("#backupPath").value = selected.path;
  $("#backupPathDisplay").value = selected.path;
  updateConnectBackupButtonState(state);
  setBackupMeta(`Wybrano plik ${selected.name} (${selected.size_mb} MB).`, "success");
  setBackupInfo({
    tone: "success",
    title: "Backup gotowy do podłączenia",
    text: "Plik został poprawnie wskazany. Możesz teraz uruchomić podłączenie lokalnej kopii bazy.",
    details: [
        ["Plik", selected.path],
        ["Rozmiar", `${selected.size_mb} MB`],
        ["Zakres danych", importYearsLabel(getSelectedImportYears(state))],
        ["Tryb", "Tylko do odczytu"],
      ],
    });
}

async function connectBackup(state) {
  const path = $("#backupPath").value.trim();
  const importYears = getSelectedImportYears(state);
  const previousDatabase = $("#sqlDatabase").value.trim();
  if (!path) {
    setBackupMeta("Najpierw kliknij „Wgraj plik” i wskaż backup.", "error");
    setBackupInfo({
      tone: "error",
      title: "Brak wybranego backupu",
      text: "Wskaż plik .BAK lub .BAC, aby rozpocząć podłączanie bazy.",
    });
    return;
  }
  if (!importYears.length) {
    setBackupMeta("Wybierz co najmniej jeden rok do importu.", "error");
    setBackupInfo({
      tone: "error",
      title: "Brak zakresu importu",
      text: "Zaznacz co najmniej jeden rok, który ma zostać uwzględniony w analizie.",
    });
    return;
  }
  setBackupMeta("Sprawdzam backup przed podłączeniem...");
  setBackupInfo({
    tone: "loading",
    title: "Weryfikacja backupu",
    text: "Sprawdzam strukturę pliku i przygotowuję parametry odtworzenia lokalnej kopii.",
    details: [["Plik", path]],
  });
  $("#connectBackup").disabled = true;
  try {
    const inspected = await inspectSelectedBackup(path);
    const request = {
      path,
      server: $("#sqlServer").value.trim(),
      target_database: inspected.suggested_database || $("#sqlDatabase").value.trim(),
    };
    setBackupMeta("Podłączam bazę w trybie tylko do odczytu. To może potrwać...");
    setBackupInfo({
      tone: "loading",
      title: "Trwa podłączanie bazy",
      text: "Odtwarzam lokalną kopię SQL i przygotowuję ją do pracy z raportami.",
      details: [
        ["Docelowa baza", request.target_database],
        ["Źródło", path],
        ["Zakres danych", importYearsLabel(importYears)],
        ["Tryb", "Tylko do odczytu"],
      ],
    });
    const response = await fetch("/api/connect-backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "Nie udało się podłączyć backupu.");
    $("#sqlDatabase").value = payload.database;
    persistDatabase(payload.database);
    setBackupMeta(`Połączono z bazą ${payload.database}.`, "success");
    setBackupInfo({
      tone: "success",
      title: "Baza została podłączona",
      text: "Lokalna kopia SQL jest aktywna i gotowa do dalszej pracy w raportach.",
      details: [
        ["Baza", payload.database],
        ["Plik źródłowy", payload.source_path],
        ["Zakres danych", importYearsLabel(importYears)],
        ["Tryb", "Tylko do odczytu"],
      ],
    });
    updateBadges(state);
    updateTimeFilterMeta(state);
    await loadAvailableYears(state);
    await loadAvailableData(state);
    await loadActiveReportData(state);
  } catch (error) {
    $("#sqlDatabase").value = previousDatabase;
    persistDatabase(previousDatabase);
    updateBadges(state);
    renderActiveReport(state);
    if (!previousDatabase) renderNoDatabase(state);
    setBackupMeta(`Nie udało się podłączyć bazy: ${error.message}`, "error");
    setBackupInfo({
      tone: "error",
      title: "Błąd podłączenia",
      text: error.message,
      details: path ? [["Plik", path]] : [],
    });
  } finally {
    updateConnectBackupButtonState(state);
  }
}

async function inspectSelectedBackup(path) {
  const response = await fetch("/api/backup-info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      server: $("#sqlServer").value.trim(),
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error || "Nie udało się sprawdzić backupu.");
  }
  return payload;
}

async function loadAvailableData(state) {
  if (!$("#sqlDatabase").value.trim()) {
    state.availableData = [];
    renderNoDatabase(state);
    return;
  }

  const request = {
    server: $("#sqlServer").value.trim(),
    database: $("#sqlDatabase").value.trim(),
    ...getAllowedYearsPayload(state),
    ...getTimeFilterPayload(state),
  };
  try {
    const response = await fetch("/api/available-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "Nie udało się pobrać katalogu danych.");
    state.availableData = payload.modules || [];
    renderAvailableData(state);
    renderAdministration(state);
    renderActiveReport(state);
  } catch (error) {
    state.availableData = [];
    const message = `<div class="available-card is-empty">Brak połączenia: ${escapeHtml(error.message)}</div>`;
    $("#databaseDataList").innerHTML = message;
    renderActiveReport(state);
  }
}

async function loadAvailableYears(state) {
  const database = $("#sqlDatabase").value.trim();
  if (!database) {
    state.availableYears = [];
    renderYearOptions(state, "");
    return;
  }

  const currentYear = $("#filterYear").value.trim();
  try {
    const query = new URLSearchParams({
      server: $("#sqlServer").value.trim(),
      database,
      allowed_years: getSelectedImportYears(state).join(","),
    });
    const response = await fetch(`/api/years?${query.toString()}`);
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "Nie udało się pobrać lat z bazy.");

    state.availableYears = (payload.years || []).map((year) => String(year));
    const fallbackYear = defaultTimeFilterYear(state);
    const selectedYear = state.availableYears.includes(currentYear)
      ? currentYear
      : state.availableYears.includes(fallbackYear)
        ? fallbackYear
        : "";
    renderYearOptions(state, selectedYear);
    updateTimeFilterMeta(state);
    renderAdministration(state);
  } catch (_error) {
    state.availableYears = [];
    renderYearOptions(state, currentYear);
    updateTimeFilterMeta(state);
    renderAdministration(state);
  }
}

async function ensureAvailableYearsLoaded(state) {
  if (!$("#sqlDatabase").value.trim()) return;
  const hasLoadedYears = (state.availableYears || []).length > 0;
  const hasMultipleOptions = $("#filterYear").options.length > 1;
  if (hasLoadedYears && hasMultipleOptions) return;
  await loadAvailableYears(state);
}

function renderYearOptions(state, selectedYear) {
  const availableYears = (state.availableYears || []).map((year) => String(year)).filter(Boolean);
  const importYears = getSelectedImportYears(state).map((year) => String(year)).filter(Boolean);
  const years = [...new Set((availableYears.length ? availableYears : importYears))].sort();
  const preferredYear = selectedYear && years.includes(String(selectedYear))
    ? String(selectedYear)
    : defaultTimeFilterYear(state);
  const effectiveSelectedYear = years.includes(preferredYear)
    ? preferredYear
    : years.at(-1) || "";

  const html = years.length
    ? years.map((year) => {
      const selected = year === effectiveSelectedYear ? " selected" : "";
      return `<option value="${escapeHtml(year)}"${selected}>${escapeHtml(year)}</option>`;
    }).join("")
    : '<option value="">Brak lat</option>';

  $("#filterYear").innerHTML = html;
}

function defaultYearFromDatabase(years) {
  const currentYear = String(new Date().getFullYear());
  if (years.includes(currentYear)) return currentYear;

  const currentYearNumber = Number(currentYear);
  return years.find((year) => Number(year) <= currentYearNumber) || years[0] || "";
}

function defaultMonthValue() {
  return "";
}

async function loadActiveReportData(state) {
  const report = getCurrentReport(state);
  if (!$("#sqlDatabase").value.trim()) {
    const restored = await ensureDatabaseAvailable(state);
    if (!restored) {
      clearReportData(state);
      state.reportDataStatus = "no-database";
      renderReportData(state);
      return;
    }
  }

  state.reportDataStatus = "loading";
  state.reportDataKey = report.key;
  renderReportData(state);

  const request = buildReportDataRequest(report, state);

  try {
    const response = await fetch("/api/report-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
      throw new Error(payload.error || "Nie udało się pobrać wyników raportu.");
    }
    applyReportDataPayload(state, report, payload);
  } catch (error) {
    applyReportDataError(state, report, error);
  }
}

function buildReportDataRequest(report, state) {
  return {
    report: report.queryKey,
    report_title: report.title,
    module: report.primaryModule,
    server: $("#sqlServer").value.trim(),
    database: $("#sqlDatabase").value.trim(),
    ...getAllowedYearsPayload(state),
    ...getTimeFilterPayload(state),
  };
}

function applyReportDataPayload(state, report, payload) {
  state.reportHeaders = payload.headers || [];
  state.reportRawRows = payload.rows || [];
  state.reportRows = filterReportRows(state, state.reportRawRows);
  state.reportNotes = payload.notes || [];
  state.reportSource = payload.source || null;
  setOptimaFilterLoading(state);
  state.reportDataStatus = "ready";
  state.reportDataKey = report.key;
  renderReportFilterControls(report, state);
  syncReportLayoutState(state);
  $("#reportLayoutList").innerHTML = renderLayoutEditor(state);
  updateReportNarrativeMeta(state);
  renderReportData(state);
  refreshOptimaFilter(state);
}

function applyReportDataError(state, report, error) {
  state.reportHeaders = [];
  state.reportRows = [];
  state.reportRawRows = [];
  state.reportNotes = [];
  state.reportSource = null;
  clearOptimaFilterState(state);
  state.reportDataStatus = "error";
  state.reportDataError = error.message;
  state.reportDataKey = report.key;
  renderReportData(state);
}

function clearReportData(state) {
  state.reportHeaders = [];
  state.reportRows = [];
  state.reportRawRows = [];
  state.reportNotes = [];
  state.reportSource = null;
  clearOptimaFilterState(state);
  state.reportDataStatus = "idle";
  state.reportDataKey = "";
  state.reportDataError = "";
}

function renderNoDatabase(state) {
  const message = '<div class="available-card is-empty">Najpierw podłącz bazę.</div>';
  $("#databaseDataList").innerHTML = message;
  renderActiveReport(state);
}

function renderAvailableData(state) {
  const report = getCurrentReport(state);
  const modules = (state.availableData || []).filter((item) => Number(item.record_count || 0) > 0);
  const sorted = modules.sort((left, right) => rankModuleForReport(right, report) - rankModuleForReport(left, report));
  const html = sorted.length
    ? sorted.map((item) => availableDataCard(item, report)).join("")
    : '<div class="available-card is-empty">W tej bazie nie wykryto pewnych modułów do pobrania.</div>';
  $("#databaseDataList").innerHTML = html;
}

function availableDataCard(item, report) {
  const count = Number(item.record_count || 0).toLocaleString("pl-PL");
  const sensitive = Number(item.sensitive || 0) ? '<span class="available-note">dane wrażliwe</span>' : "";
  const tone = reportUsesModule(report, item.code) ? " is-related" : "";
  const sourceTag = item.code === report?.primaryModule
    ? '<span class="available-note available-note-main">główne źródło raportu</span>'
    : reportUsesModule(report, item.code)
      ? '<span class="available-note">powiązane źródło raportu</span>'
      : "";
  return `
    <div class="available-card${tone}" data-module="${escapeHtml(item.code)}">
      <div class="available-title">
        <span>${escapeHtml(item.label)}</span>
        <span class="available-count">${escapeHtml(count)}</span>
      </div>
      <span class="available-desc">${escapeHtml(item.description)}</span>
      ${sourceTag}
      ${sensitive}
    </div>`;
}

function updateBadges(state) {
  const connectedDatabase = $("#sqlDatabase").value.trim();
  const databaseName = connectedDatabase || "Brak podłączonej bazy";
  const report = getCurrentReport(state);
  const view = state.currentView || "start";
  const topbarDb = document.querySelector(".topbar-db");
  $("#connectedDatabaseName").textContent = databaseName;
  topbarDb?.classList.toggle("is-connected", Boolean(connectedDatabase));
  topbarDb?.classList.toggle("is-disconnected", !connectedDatabase);
  if (view === "communication") {
    $("#viewSubtitle").textContent = "Podłącz backup SQL i sprawdź listę pewnych danych wykrytych w bazie.";
    return;
  }
  if (view === "administration") {
    $("#viewSubtitle").textContent = "Porównaj eksport Excela z Optimy z odczytem SQL i sprawdź, czy mapowanie jest pewne.";
    return;
  }
  if (view === "report") {
    $("#viewSubtitle").textContent = report?.question || "Wybierz raport z menu po lewej.";
    return;
  }
  $("#viewSubtitle").textContent = "Strona startowa: wybierz Komunikację albo przejdź do jednej z grup raportów.";
}

async function applyTimeFilter(state) {
  updateTimeFilterMeta(state);
  await loadAvailableData(state);
  await loadActiveReportData(state);
  renderAdministration(state);
}

async function clearTimeFilters(state) {
  $("#filterYear").value = defaultTimeFilterYear(state);
  $("#filterMonth").value = defaultMonthValue();
  $("#filterDateFrom").value = "";
  $("#filterDateTo").value = "";
  await applyTimeFilter(state);
}

function getTimeFilterPayload(state) {
  const selectedYear = $("#filterYear").value.trim();
  const month = $("#filterMonth").value;
  const dateFrom = $("#filterDateFrom").value;
  const dateTo = $("#filterDateTo").value;
  const fallbackYear = defaultTimeFilterYear(state);
  const year = selectedYear || (month ? fallbackYear : "");

  if (dateFrom || dateTo) {
    return { date_from: dateFrom, date_to: dateTo };
  }
  if (year && month) {
    return { period: `${year}${month}` };
  }
  if (year) {
    return { year };
  }
  return {};
}

function updateTimeFilterMeta(state) {
  const description = describeTimeFilter(state);
  $("#timeFilterMeta").textContent = `Filtr: ${description}`;
}

function describeTimeFilter(state) {
  const year = $("#filterYear").value.trim();
  const month = $("#filterMonth").value;
  const monthLabel = $("#filterMonth").selectedOptions[0]?.textContent.toLowerCase() || "";
  const dateFrom = $("#filterDateFrom").value;
  const dateTo = $("#filterDateTo").value;

  if (dateFrom || dateTo) {
    if (dateFrom && dateTo) return `${dateFrom} - ${dateTo}`;
    if (dateFrom) return `od ${dateFrom}`;
    return `do ${dateTo}`;
  }
  if (year && month) return `${monthLabel} ${year}`;
  if (year) return `rok ${year}`;
  const importYears = getSelectedImportYears(state);
  return importYears.length === 1 ? `rok ${importYears[0]}` : `lata ${importYears[0]}-${importYears[importYears.length - 1]}`;
}

function renderSideMenu(state) {
  const mainItems = [
    sideViewItem("start", "START", "Strona startowa", state),
    sideViewItem("communication", "Komunikacja", "Podłączanie bazy i wykryte dane", state),
    sideViewItem("report", "Raport", "Aktywny raport i wyniki SQL", state),
    ...SIDEBAR_GROUP_IDS.map((groupId) => sideReportGroup(REPORT_GROUPS_BY_ID[groupId], state)),
  ].join("");
  $("#sideMenu").innerHTML = `
    <div class="side-menu-main">${mainItems}</div>
    <div class="side-menu-footer">
      ${sideViewItem("administration", "Administracja", "Walidacja Excel vs SQL i kontrola poprawności odczytu", state)}
    </div>`;
  return;
  $("#sideMenu").innerHTML = [
    sideViewItem("start", "START", "Strona startowa", state),
    sideViewItem("communication", "Komunikacja", "Podłączanie bazy i wykryte dane", state),
    sideViewItem("report", "Raport", "Aktywny raport i wyniki SQL", state),
    ...SIDEBAR_GROUP_IDS.map((groupId) => sideReportGroup(REPORT_GROUPS_BY_ID[groupId], state)),
  ].join("");
}

function renderCurrentView(state) {
  const activeView = state.currentView || "start";
  [
    ["start", "#viewStart"],
    ["communication", "#viewCommunication"],
    ["administration", "#viewAdministration"],
    ["report", "#viewReport"],
  ].forEach(([viewKey, selector]) => {
    $(selector).classList.toggle("is-active", viewKey === activeView);
  });
}

function renderStartFavorites(state) {
  const favorites = (state.favoriteReports || [])
    .map((key) => REPORTS_BY_KEY[key])
    .filter(Boolean);

  $("#startFavoritesMeta").textContent = favorites.length
    ? `${favorites.length} ulubionych raportów`
    : "Brak ulubionych raportów";
  $("#startFavorites").innerHTML = favorites.length
    ? favorites.map((report) => startFavoriteCard(report)).join("")
    : `
      <article class="start-empty-state">
        <span class="meta-label">START</span>
        <strong>Nie masz jeszcze ulubionych raportów</strong>
        <p>Otwórz dowolny raport i kliknij gwiazdkę obok jego nazwy.</p>
        <span class="start-empty-hint">Tu będą się pojawiały Twoje szybkie skróty.</span>
      </article>`;
}

function renderAdministration(state) {
  const profile = selectedAdminProfile();
  const scope = $("#adminValidationScope");
  const profileMeta = $("#adminProfileMeta");
  const catalog = $("#adminValidationCatalog");
  const runButton = $("#runAdminValidation");
  const uploadMeta = $("#adminUploadMeta");
  const previewMeta = $("#adminPreviewMeta");

  if (scope) scope.textContent = adminValidationScopeText();
  if (profileMeta) profileMeta.textContent = adminProfileMetaText(profile);
  if (catalog) {
    catalog.innerHTML = ADMIN_EXPORT_PROFILES.map((item) => `
      <article class="admin-profile-card${item.code === profile?.code ? " is-active" : ""}${item.support === "sql" ? " is-sql" : ""}">
        <div class="available-title">
          <span>${escapeHtml(item.label)}</span>
          <span class="available-count">${escapeHtml(item.supportLabel)}</span>
        </div>
        <span class="available-desc">${escapeHtml(item.description)}</span>
      </article>
    `).join("");
  }
  if (runButton) runButton.disabled = !profile || !ADMIN_SQL_VALIDATION_KINDS.has(profile.code);
  $("#adminFilterMeta").textContent = `Filtr globalny: ${describeTimeFilter(state)}`;
  if (uploadMeta) uploadMeta.textContent = adminUploadMetaText(state);
  if (previewMeta) {
    previewMeta.textContent = state.adminSourceFileName
      ? `${state.adminSourceFileName}: ${(state.adminSourceFile?.rows?.length || 0).toLocaleString("pl-PL")} wierszy, ${state.adminPreviewHeaders.length} kolumn.`
      : "Brak załadowanego pliku.";
  }

  renderAdminPreviewTable(state.adminPreviewHeaders, state.adminPreviewRows);
  renderAdminValidationResult(state);
}
async function loadAdminFile(state) {
  const file = $("#adminValidationFile").files?.[0];
  state.adminValidationResult = null;
  state.adminValidationError = "";
  state.adminValidationStatus = "idle";

  if (!file) {
    state.adminSourceFile = null;
    state.adminSourceFileName = "";
    state.adminSourceFormat = "";
    state.adminPreviewHeaders = [];
    state.adminPreviewRows = [];
    renderAdministration(state);
    return;
  }

  $("#adminUploadMeta").textContent = `Wczytuję plik ${file.name}...`;
  try {
    const parsed = await parseInputFile(file);
    state.adminSourceFile = parsed;
    state.adminSourceFileName = file.name;
    state.adminSourceFormat = parsed.format || "XLSX";
    state.adminPreviewHeaders = parsed.headers || [];
    state.adminPreviewRows = (parsed.rows || []).slice(0, 10);
    renderAdministration(state);
  } catch (error) {
    state.adminSourceFile = null;
    state.adminSourceFileName = file.name;
    state.adminSourceFormat = "";
    state.adminPreviewHeaders = [];
    state.adminPreviewRows = [];
    state.adminValidationStatus = "error";
    state.adminValidationError = error.message;
    renderAdministration(state);
  }
}

function clearAdminValidation(state) {
  $("#adminValidationFile").value = "";
  state.adminSourceFile = null;
  state.adminSourceFileName = "";
  state.adminSourceFormat = "";
  state.adminPreviewHeaders = [];
  state.adminPreviewRows = [];
  state.adminValidationStatus = "idle";
  state.adminValidationResult = null;
  state.adminValidationError = "";
  renderAdministration(state);
}

async function runAdminValidation(state) {
  const profile = selectedAdminProfile();
  if (!state.adminSourceFile) {
    state.adminValidationStatus = "error";
    state.adminValidationError = "Najpierw wybierz plik eksportu z Optimy.";
    renderAdministration(state);
    return;
  }

  if (!profile || !ADMIN_SQL_VALIDATION_KINDS.has(profile.code)) {
    state.adminValidationStatus = "error";
    state.adminValidationError = `Profil ${profile?.label || "nieznany"} jest na liście parsera, ale nie ma jeszcze jawnego mapowania SQL 1:1.`;
    renderAdministration(state);
    return;
  }

  if (!$("#sqlDatabase").value.trim()) {
    const restored = await ensureDatabaseAvailable(state);
    if (!restored) {
      state.adminValidationStatus = "error";
      state.adminValidationError = "Najpierw podłącz bazę SQL.";
      renderAdministration(state);
      return;
    }
  }

  state.adminValidationStatus = "loading";
  state.adminValidationResult = null;
  state.adminValidationError = "";
  renderAdministration(state);

  const payload = {
    kind: profile.code,
    headers: state.adminSourceFile.headers || [],
    rows: state.adminSourceFile.rows || [],
    server: $("#sqlServer").value.trim(),
    database: $("#sqlDatabase").value.trim(),
    ...getAllowedYearsPayload(state),
    ...getTimeFilterPayload(state),
  };

  try {
    const response = await fetch("/api/sql-validation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || result.error) {
      throw new Error(result.error || "Nie udało się zweryfikować zgodności Excela z SQL.");
    }
    state.adminValidationStatus = "ready";
    state.adminValidationResult = result;
    renderAdministration(state);
  } catch (error) {
    state.adminValidationStatus = "error";
    state.adminValidationError = error.message;
    renderAdministration(state);
  }
}

function renderAdminPreviewTable(headers, rows) {
  const previewHeaders = headers.slice(0, 8);
  $("#adminPreviewHead").innerHTML = previewHeaders.length
    ? `<tr>${previewHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`
    : "";
  $("#adminPreviewRows").innerHTML = rows.length
    ? rows.map((row) => `<tr>${previewHeaders.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>`).join("")
    : `<tr><td class="empty" colspan="${Math.max(previewHeaders.length, 1)}">Podgląd pojawi się po wskazaniu pliku.</td></tr>`;
}

function renderAdminValidationResult(state) {
  const status = state.adminValidationStatus;
  const result = state.adminValidationResult;
  const noDataCard = '<div class="available-card is-empty">Uruchom walidację, aby zobaczyć wynik porównania.</div>';

  if (status === "loading") {
    $("#adminValidationMeta").hidden = false;
    $("#adminValidationMeta").textContent = "Trwa porównanie Excela z SQL...";
    $("#adminValidationMetrics").innerHTML = "";
    $("#adminMappingRows").innerHTML = '<tr><td class="empty" colspan="4">Trwa mapowanie pól i porównanie danych.</td></tr>';
    $("#adminDiffMeta").textContent = "Porównanie w toku.";
    $("#adminExcelOnly").innerHTML = noDataCard;
    $("#adminSqlOnly").innerHTML = noDataCard;
    $("#adminTotalsMeta").textContent = "Trwa budowanie sum kontrolnych.";
    $("#adminTotals").innerHTML = noDataCard;
    return;
  }

  if (status === "error") {
    $("#adminValidationMeta").hidden = false;
    $("#adminValidationMeta").textContent = `Błąd walidacji: ${state.adminValidationError || "nieznany błąd"}`;
    $("#adminValidationMetrics").innerHTML = "";
    $("#adminMappingRows").innerHTML = '<tr><td class="empty" colspan="4">Walidacja nie powiodła się.</td></tr>';
    $("#adminDiffMeta").textContent = "Brak wyniku porównania.";
    $("#adminExcelOnly").innerHTML = noDataCard;
    $("#adminSqlOnly").innerHTML = noDataCard;
    $("#adminTotalsMeta").textContent = "Brak sum kontrolnych.";
    $("#adminTotals").innerHTML = noDataCard;
    return;
  }

  if (!result) {
    $("#adminValidationMeta").hidden = true;
    $("#adminValidationMetrics").innerHTML = "";
    $("#adminMappingRows").innerHTML = '<tr><td class="empty" colspan="4">Mapowanie pojawi się po uruchomieniu walidacji.</td></tr>';
    $("#adminDiffMeta").textContent = "Brak porównania.";
    $("#adminExcelOnly").innerHTML = noDataCard;
    $("#adminSqlOnly").innerHTML = noDataCard;
    $("#adminTotalsMeta").textContent = "Po walidacji zobaczysz sumy oraz próbki porównania.";
    $("#adminTotals").innerHTML = noDataCard;
    return;
  }

  $("#adminValidationMeta").hidden = false;
  $("#adminValidationMeta").textContent = result.status === "success"
    ? `Pełna zgodność dla profilu ${result.kind_label}.`
    : `Wykryto rozbieżności dla profilu ${result.kind_label}.`;
  $("#adminValidationMetrics").innerHTML = [
    { label: "Status", value: result.status === "success" ? "Pełna zgodność" : "Rozbieżności", tone: result.status === "success" ? "success" : "warning" },
    { label: "Wiersze Excel", value: formatCount(result.summary.excel_rows), tone: "info" },
    { label: "Wiersze SQL", value: formatCount(result.summary.sql_rows), tone: "info" },
    { label: "Dopasowane", value: formatCount(result.summary.matched_rows), tone: "success" },
    { label: "Tylko Excel", value: formatCount(result.summary.excel_only_rows), tone: result.summary.excel_only_rows ? "warning" : "neutral" },
    { label: "Tylko SQL", value: formatCount(result.summary.sql_only_rows), tone: result.summary.sql_only_rows ? "warning" : "neutral" },
    { label: "Zgodność", value: result.summary.match_rate, tone: result.status === "success" ? "success" : "warning" },
  ].map(metricCard).join("");
  $("#adminMappingRows").innerHTML = result.mapping.fields.length
    ? result.mapping.fields.map(adminMappingRow).join("")
    : '<tr><td class="empty" colspan="4">Brak wspólnych pól do porównania.</td></tr>';
  $("#adminDiffMeta").textContent = `Porównywane pola: ${result.mapping.compared_fields.join(", ") || "brak"}.`;
  $("#adminExcelOnly").innerHTML = result.differences.excel_only_sample.length
    ? result.differences.excel_only_sample.map((row) => adminDifferenceCard(row, "Tylko w Excelu")).join("")
    : '<div class="available-card is-empty">Brak wierszy występujących tylko w Excelu.</div>';
  $("#adminSqlOnly").innerHTML = result.differences.sql_only_sample.length
    ? result.differences.sql_only_sample.map((row) => adminDifferenceCard(row, "Tylko w SQL")).join("")
    : '<div class="available-card is-empty">Brak wierszy występujących tylko w SQL.</div>';
  $("#adminTotalsMeta").textContent = result.notes.join(" ");
  $("#adminTotals").innerHTML = [
    ...result.totals.map((item) => adminTotalCard(item)),
    adminPreviewCard("Próbka Excel", result.preview.excel_sample),
    adminPreviewCard("Próbka SQL", result.preview.sql_sample),
  ].join("") || noDataCard;
}

function adminMappingRow(item) {
  return `
    <tr>
      <td>${escapeHtml(item.label)}</td>
      <td>${escapeHtml(item.excel_header || "—")}</td>
      <td>${escapeHtml(item.sql_header || "—")}</td>
      <td>${item.compared ? "TAK" : "NIE"}</td>
    </tr>`;
}

function adminDifferenceCard(row, title) {
  return `
    <article class="available-card">
      <div class="available-title">
        <span>${escapeHtml(title)}</span>
      </div>
      <div class="admin-row-preview">${Object.entries(row).map(([key, value]) => `<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</div>`).join("")}</div>
    </article>`;
}

function adminTotalCard(item) {
  const tone = item.match ? " is-related" : "";
  return `
    <article class="available-card${tone}">
      <div class="available-title">
        <span>${escapeHtml(item.label)}</span>
        <span class="available-count">${item.match ? "OK" : "RÓŻNICA"}</span>
      </div>
      <div class="admin-row-preview">
        <div><strong>Excel:</strong> ${escapeHtml(item.excel_total)}</div>
        <div><strong>SQL:</strong> ${escapeHtml(item.sql_total)}</div>
        <div><strong>Różnica:</strong> ${escapeHtml(item.difference)}</div>
      </div>
    </article>`;
}

function adminPreviewCard(title, rows) {
  if (!rows?.length) {
    return `
      <article class="available-card is-empty">
        <div class="available-title"><span>${escapeHtml(title)}</span></div>
        <span class="available-desc">Brak rekordów do pokazania.</span>
      </article>`;
  }

  return `
    <article class="available-card">
      <div class="available-title"><span>${escapeHtml(title)}</span></div>
      <div class="admin-row-preview">
        ${rows.map((row) => `<div class="admin-preview-entry">${Object.entries(row).map(([key, value]) => `<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</div>`).join("")}</div>`).join("")}
      </div>
    </article>`;
}

function sideViewItem(viewKey, title, description, state) {
  const active = state.currentView === viewKey ? " is-active" : "";
  return `
    <button type="button" class="side-menu-card${active}" data-view-key="${escapeHtml(viewKey)}">
      <span class="side-menu-title">${escapeHtml(title)}</span>
      <span class="side-menu-meta">${escapeHtml(description)}</span>
    </button>`;
}

function sideReportGroup(group, state) {
  if (!group) return "";
  const groupActive = state.currentView === "report" && group.reports.some((report) => report.key === state.currentReportKey);
  const groupExpanded = isSidebarGroupExpanded(state, group.id);
  return `
    <section class="side-menu-group${groupActive ? " is-active" : ""}${groupExpanded ? " is-expanded" : ""}">
      <button type="button" class="side-menu-group-head" data-report-group="${escapeHtml(group.id)}" aria-expanded="${groupExpanded ? "true" : "false"}">
        <span>${escapeHtml(group.title)}</span>
        <strong>${group.reports.length}</strong>
      </button>
      <div class="side-submenu">
        ${group.reports.map((report) => sideReportItem(report, state)).join("")}
      </div>
    </section>`;
}

function sideReportItem(report, state) {
  const active = state.currentView === "report" && report.key === state.currentReportKey ? " is-active" : "";
  return `
    <button type="button" class="side-child-item${active}" data-report-key="${escapeHtml(report.key)}">
      <span class="report-nav-title">${escapeHtml(report.title)}</span>
      <span class="report-nav-meta">${escapeHtml(report.priority)}</span>
    </button>`;
}

function renderActiveReport(state) {
  const report = getCurrentReport(state);
  if (!report) return;

  placeReportStacks(report);
  $("#reportSection").textContent = report.section;
  $("#reportTitle").textContent = report.title;
  $("#reportSummary").textContent = report.summary;
  renderReportFilterControls(report, state);
  syncReportLayoutState(state);
  updateReportNarrativeMeta(state);
  $("#reportTags").innerHTML = report.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  $("#reportControls").innerHTML = renderReportSelectionStack(report, report.controls, state.reportControlSelections, "control");
  $("#reportLayoutList").innerHTML = renderLayoutEditor(state);
  $("#reportAlerts").innerHTML = renderReportSelectionStack(report, report.alerts, state.reportAlertSelections, "alert");
  renderReportActions(state);
  renderReportData(state);
  renderReportChart(state);
  updateBadges(state);
}

function placeReportStacks(report) {
  const heroSlot = $("#reportHeroStacksSlot");
  const bottomSlot = $("#reportBottomStacksSlot");
  const block = $("#reportStacksBlock");
  if (!heroSlot || !bottomSlot || !block) return;

  const useHeroSlot = HERO_STACK_REPORTS.has(report?.key);
  const targetSlot = useHeroSlot ? heroSlot : bottomSlot;
  if (block.parentElement !== targetSlot) targetSlot.appendChild(block);

  heroSlot.hidden = !useHeroSlot;
  bottomSlot.hidden = useHeroSlot;
}

function renderReportData(state) {
  const report = getCurrentReport(state);
  const status = state.reportDataStatus;
  const rowsBelongToReport = state.reportDataKey === report.key;
  const visibleHeaders = getVisibleReportHeaders(state);
  $("#refreshReportData").disabled = !$("#sqlDatabase").value.trim() || status === "loading";
  renderReportFilterIndicator(state);

  if (!$("#sqlDatabase").value.trim()) {
    renderReportDataPlaceholder(
      state,
      "Podłącz bazę, żeby zobaczyć konkretne dokumenty z raportu.",
      "Najpierw podłącz bazę SQL.",
    );
    return;
  }
  if (status === "loading") {
    renderReportDataPlaceholder(
      state,
      `Pobieram wyniki raportu „${report.title}” dla filtra: ${describeTimeFilter()}.`,
      "Pobieram dane z SQL...",
    );
    return;
  }
  if (status === "error" && rowsBelongToReport) {
    renderReportDataPlaceholder(
      state,
      `Błąd pobierania raportu: ${state.reportDataError || "nieznany błąd"}`,
      "Nie udało się pobrać wyników raportu.",
    );
    return;
  }
  if (!rowsBelongToReport) {
    renderReportDataPlaceholder(
      state,
      "Raport ma aktywne połączenie do SQL i czeka na załadowanie wyników.",
      "Kliknij „Odśwież wyniki”, żeby pobrać dane.",
    );
    return;
  }

  $("#reportDataMeta").textContent = buildReportDataMeta(report, state);
  updateReportFilterMeta(state);
  renderReportTable(
    state,
    visibleHeaders,
    state.reportRows,
    "Brak dokumentów spełniających warunek raportu w wybranym okresie.",
  );
  renderReportCompanionPanels(state);
}

function renderReportDataPlaceholder(state, metaText, emptyMessage) {
  $("#reportDataMeta").textContent = metaText;
  renderReportFilterIndicator(state);
  renderReportTable(state, [], [], emptyMessage);
  renderReportCompanionPanels(state);
}

function buildReportDataMeta(report, state) {
  const sourceLabel = state.reportSource?.module ? ` źródło: ${moduleLabel(state.reportSource.module)}.` : "";
  const headerFilterLabel = reportUsesEmbeddedHeaderFilters(report)
    ? " Dodatkowe filtry są dostępne w nagłówkach tabeli."
    : "";
  return `${report.title}: ${state.reportRows.length.toLocaleString("pl-PL")} wierszy, filtr: ${describeTimeFilter()}.${sourceLabel}${headerFilterLabel}`;
}

function renderReportTable(state, headers, rows, emptyMessage) {
  const report = getCurrentReport(state);
  $("#reportDataHead").innerHTML = headers.length
    ? buildReportTableHead(report, state, headers)
    : "";
  $("#reportDataRows").innerHTML = rows.length
    ? rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>`).join("")
    : `<tr><td class="empty" colspan="${Math.max(headers.length, 1)}">${escapeHtml(emptyMessage)}</td></tr>`;
}

function buildReportTableHead(report, state, headers) {
  const headRow = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;
  const filterRow = reportUsesEmbeddedHeaderFilters(report)
    ? renderEmbeddedHeaderFilterRow(report, state, headers)
    : "";
  return `${headRow}${filterRow}`;
}

function renderEmbeddedHeaderFilterRow(report, state, headers) {
  const config = embeddedHeaderFiltersForReport(report, headers);
  if (!config.length) return "";
  return `
    <tr class="report-header-filter-row">
      ${headers.map((header) => renderEmbeddedHeaderFilterCell(config, header, state, headers)).join("")}
    </tr>`;
}

function embeddedHeaderFiltersForReport(report, headers) {
  const explicit = EMBEDDED_HEADER_FILTERS[report?.key] || [];
  if (explicit.length) return explicit;
  const sourceHeaders = headers.length ? headers : (report?.layout || []);
  return sourceHeaders.map((header) => ({
    header,
    filter: header,
    type: defaultEmbeddedHeaderFilterType(header),
    headers: [header],
    emptyLabel: defaultEmbeddedHeaderEmptyLabel(header),
    placeholder: defaultEmbeddedHeaderPlaceholder(header),
  }));
}

function defaultEmbeddedHeaderFilterType(header) {
  const normalized = normalizeText(header);
  const words = normalized.split(" ").filter(Boolean);
  if (
    isAmountHeader(header)
    || ["liczba", "ilosc", "dni", "wiek", "saldo", "budzet", "wykonanie", "odchylenie", "marza"].some((part) => words.includes(part))
  ) {
    return "number-condition";
  }
  if (words.includes("data") || (words.includes("termin") && !words.includes("dni")) || words.includes("okres")) return "date-condition";
  if (
    ["status", "typ", "waluta", "obszar", "zrodlo", "magazyn", "powiazanie", "sekcja", "wlasciciel", "projekt", "mpk", "zadanie", "kontrahent", "dostawca"].some((part) => words.includes(part))
  ) {
    return "select";
  }
  return "text";
}

function defaultEmbeddedHeaderEmptyLabel(header) {
  const normalized = normalizeText(header);
  if (normalized.includes("status")) return "Wszystkie statusy";
  if (normalized.includes("typ")) return "Wszystkie typy";
  if (normalized.includes("waluta")) return "Wszystkie waluty";
  if (normalized.includes("kontrahent")) return "Wszyscy kontrahenci";
  if (normalized.includes("dostawca")) return "Wszyscy dostawcy";
  if (normalized.includes("projekt")) return "Wszystkie projekty";
  if (normalized.includes("mpk")) return "Wszystkie MPK";
  return "Wszystkie";
}

function defaultEmbeddedHeaderPlaceholder(header) {
  const normalized = normalizeText(header);
  if (normalized.includes("numer")) return "Szukaj numeru";
  if (normalized.includes("kontrahent") || normalized.includes("dostawca")) return "Szukaj";
  if (normalized.includes("opis") || normalized.includes("tytul")) return "Szukaj";
  return "Filtruj";
}

function renderEmbeddedHeaderFilterCell(config, header, state, headers) {
  const filterConfig = config.find((item) => normalizeText(item.header) === normalizeText(header));
  if (!filterConfig) return '<th class="report-header-filter-cell is-empty"></th>';

  const key = filterKey(filterConfig.filter);
  const value = state.reportFilterValues?.[key] || {};
  const targetHeaders = filterConfig.headers || [header];
  const targetHeadersAttr = escapeHtml(targetHeaders.join("||"));

  if (filterConfig.type === "select") {
    const options = selectOptionsForHeaders(targetHeaders, state.reportRawRows || state.reportRows || []);
    return `
      <th class="report-header-filter-cell">
        <label class="report-header-filter-field" data-report-filter="${escapeHtml(key)}" data-filter-label="${escapeHtml(filterConfig.filter)}" data-filter-type="select" data-filter-headers="${targetHeadersAttr}">
          <select class="report-header-filter-control" aria-label="${escapeHtml(filterConfig.filter)}">
            <option value="">${escapeHtml(filterConfig.emptyLabel || "Wszystkie")}</option>
            ${options.map((option) => `<option value="${escapeHtml(option)}"${option === value.value ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}
          </select>
        </label>
      </th>`;
  }

  if (filterConfig.type === "date-condition") {
    const operator = value.operator || "";
    const isRange = operator === "between";
    const needsDateValue = operator && !isRange;
    return `
      <th class="report-header-filter-cell">
        <div class="report-header-filter-field report-header-filter-date${isRange ? " is-range" : ""}${needsDateValue ? " is-single" : ""}" data-report-filter="${escapeHtml(key)}" data-filter-label="${escapeHtml(filterConfig.filter)}" data-filter-type="date-condition" data-filter-headers="${targetHeadersAttr}">
          <select class="report-header-filter-control" data-filter-part="operator" aria-label="${escapeHtml(filterConfig.filter)} warunek">
            ${[
              ["", "Dowolnie"],
              ["eq", "Dokładnie"],
              ["gt", "Po"],
              ["gte", "Od"],
              ["lt", "Przed"],
              ["lte", "Do"],
              ["between", "Od-do"],
            ].map(([optionValue, label]) => `<option value="${optionValue}"${optionValue === operator ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}
          </select>
          ${needsDateValue || isRange ? `
            <input
              type="date"
              class="report-header-filter-control"
              data-filter-part="value"
              value="${escapeHtml(value.value || "")}"
              aria-label="${escapeHtml(filterConfig.filter)} wartość"
            >
          ` : ""}
          ${isRange ? `
            <input
              type="date"
              class="report-header-filter-control"
              data-filter-part="value-to"
              value="${escapeHtml(value.valueTo || "")}"
              aria-label="${escapeHtml(filterConfig.filter)} wartość do"
            >
          ` : ""}
        </div>
      </th>`;
  }

  if (filterConfig.type === "number-condition") {
    const operator = value.operator || "";
    const isRange = operator === "between";
    const needsNumericValue = operator && !isRange;
    return `
      <th class="report-header-filter-cell">
        <div class="report-header-filter-field report-header-filter-number${isRange ? " is-range" : ""}${needsNumericValue ? " is-single" : ""}" data-report-filter="${escapeHtml(key)}" data-filter-label="${escapeHtml(filterConfig.filter)}" data-filter-type="number-condition" data-filter-headers="${targetHeadersAttr}">
          <select class="report-header-filter-control" data-filter-part="operator" aria-label="${escapeHtml(filterConfig.filter)} warunek">
            ${[
              ["", "Dowolnie"],
              ["eq", "Równe"],
              ["gt", "Większe niż"],
              ["gte", "Większe lub równe"],
              ["lt", "Mniejsze niż"],
              ["lte", "Mniejsze lub równe"],
              ["between", "Od-do"],
            ].map(([optionValue, label]) => `<option value="${optionValue}"${optionValue === operator ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}
          </select>
          ${needsNumericValue || isRange ? `
            <input
              type="number"
              inputmode="numeric"
              step="1"
              min="0"
              class="report-header-filter-control"
              data-filter-part="value"
              value="${escapeHtml(value.value || "")}"
              placeholder="Wartość"
              aria-label="${escapeHtml(filterConfig.filter)} wartość"
            >
          ` : ""}
          ${isRange ? `
            <input
              type="number"
              inputmode="numeric"
              step="1"
              min="0"
              class="report-header-filter-control"
              data-filter-part="value-to"
              value="${escapeHtml(value.valueTo || "")}"
              placeholder="Do"
              aria-label="${escapeHtml(filterConfig.filter)} wartość do"
            >
          ` : ""}
        </div>
      </th>`;
  }

  return `
    <th class="report-header-filter-cell">
      <label class="report-header-filter-field" data-report-filter="${escapeHtml(key)}" data-filter-label="${escapeHtml(filterConfig.filter)}" data-filter-type="text" data-filter-headers="${targetHeadersAttr}">
        <input
          type="text"
          class="report-header-filter-control"
          value="${escapeHtml(value.value || "")}"
          placeholder="${escapeHtml(filterConfig.placeholder || "Filtruj")}"
          aria-label="${escapeHtml(filterConfig.filter)}"
        >
      </label>
    </th>`;
}

function renderReportCompanionPanels(state) {
  renderReportActions(state);
  renderOptimaFilter(state);
  renderReportChart(state);
}

function renderReportActions(state) {
  const report = getCurrentReport(state);
  const hasData = state.reportDataKey === report.key && state.reportRows.length > 0;
  const isFavorite = (state.favoriteReports || []).includes(report.key);
  const visibleHeaders = getVisibleReportHeaders(state);

  const favoriteButton = $("#toggleFavoriteReport");
  favoriteButton.innerHTML = `<span aria-hidden="true">${isFavorite ? "★" : "☆"}</span>`;
  favoriteButton.classList.toggle("is-active", isFavorite);
  favoriteButton.setAttribute("aria-pressed", String(isFavorite));
  favoriteButton.setAttribute("aria-label", isFavorite ? "Usuń raport z ulubionych" : "Dodaj raport do ulubionych");
  favoriteButton.title = isFavorite ? "Usuń raport z ulubionych" : "Dodaj raport do ulubionych";
  $("#toggleReportChart").textContent = state.reportChartEnabled ? "Ukryj wykres" : "Włącz wykres";
  $("#toggleReportChart").disabled = !hasData;
  $("#exportExcelTable").disabled = !$("#sqlDatabase").value.trim();
  $("#exportExcelChart").disabled = !$("#sqlDatabase").value.trim() || !hasChartData(visibleHeaders, state.reportRows);
  $("#exportPdfTable").disabled = !$("#sqlDatabase").value.trim();
  $("#exportPdfChart").disabled = !$("#sqlDatabase").value.trim() || !hasChartData(visibleHeaders, state.reportRows);

  const readyLabel = hasData
    ? `SQL aktywny, ${state.reportRows.length.toLocaleString("pl-PL")} wierszy gotowych do eksportu.`
    : "SQL aktywny. Załaduj dane, aby włączyć wykres i eksport z danymi.";
  $("#reportActionMeta").textContent = readyLabel;
  renderReportToolbar(state);
}

function renderReportToolbar(state) {
  const activeMenu = state.reportToolbarMenuOpen || "";
  [
    ["export", "#toggleReportExportMenu", "#reportExportMenu"],
    ["customize", "#toggleReportCustomizeMenu", "#reportCustomizeMenu"],
    ["sql", "#toggleReportOptimaMenu", "#reportOptimaMenu"],
  ].forEach(([menuKey, buttonSelector, panelSelector]) => {
    const isOpen = activeMenu === menuKey;
    const button = $(buttonSelector);
    const panel = $(panelSelector);
    button.classList.toggle("is-active", isOpen);
    button.setAttribute("aria-expanded", String(isOpen));
    panel.hidden = !isOpen;
  });
}

function renderOptimaFilter(state) {
  const report = getCurrentReport(state);
  const panel = $("#reportOptimaContent");
  const meta = $("#reportOptimaMeta");
  const hasDatabase = Boolean($("#sqlDatabase").value.trim());
  const hasLoadedRows = state.reportDataKey === report.key;

  if (!hasDatabase) {
    meta.textContent = "Najpierw podłącz bazę, aby wygenerować warunek dla Optimy.";
    panel.innerHTML = '<div class="available-card is-empty">Brak połączenia z bazą SQL.</div>';
    return;
  }
  if (!hasLoadedRows || state.reportDataStatus === "loading") {
    meta.textContent = "Filtr do Optimy pojawi się po załadowaniu wyników raportu.";
    panel.innerHTML = '<div class="available-card is-empty">Czekam na wyniki raportu.</div>';
    return;
  }
  if (state.reportOptimaFilterStatus === "loading") {
    meta.textContent = "Buduje gotowy warunek do filtra zaawansowanego Optimy.";
    panel.innerHTML = '<div class="available-card is-empty">Generowanie filtra do Optimy...</div>';
    return;
  }
  if (state.reportOptimaFilterStatus === "error") {
    meta.textContent = `Błąd generowania filtra: ${state.reportOptimaFilterError || "nieznany błąd"}`;
    panel.innerHTML = '<div class="available-card is-empty">Nie udało się zbudować filtra do Optimy.</div>';
    return;
  }

  const model = state.reportOptimaFilter;
  if (!model?.supported) {
    meta.textContent = model?.message || "Dla tego wyniku nie da się zbudować gotowego filtra.";
    panel.innerHTML = `<div class="available-card is-empty">${escapeHtml(model?.message || "Brak filtra do Optimy.")}</div>`;
    return;
  }

  meta.textContent = `${model.target_list}: ${Number(model.record_count || 0).toLocaleString("pl-PL")} pozycji gotowych do filtrowania.`;
  panel.innerHTML = `
    <div class="optima-filter-card">
      <span class="meta-label">Zalecane użycie</span>
      <strong>${escapeHtml(model.target_list)}</strong>
      <ol class="optima-filter-list">
        ${(model.instructions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ol>
      ${model.warning ? `<div class="optima-filter-warning">${escapeHtml(model.warning)}</div>` : ""}
    </div>
    ${renderOptimaSnippetCard(model.primary, "primary")}
    ${renderOptimaSnippetCard(model.secondary, "secondary")}`;
}

function renderOptimaSnippetCard(snippet, variant) {
  if (!snippet?.expression) return "";
  const buttonLabel = variant === "primary" ? "Kopiuj filtr pewny" : "Kopiuj filtr alternatywny";
  return `
    <div class="optima-filter-card">
      <span class="meta-label">${escapeHtml(snippet.label)}</span>
      <strong>${escapeHtml(snippet.description || "")}</strong>
      <textarea class="optima-filter-code" readonly>${escapeHtml(snippet.expression)}</textarea>
      <div class="optima-filter-actions">
        <button type="button" class="plain-button" data-copy-optima="${escapeHtml(snippet.expression)}">${escapeHtml(buttonLabel)}</button>
        <span class="muted">Pole: ${escapeHtml(snippet.field)} | rekordy: ${escapeHtml(String(snippet.record_count || 0))}</span>
      </div>
    </div>`;
}

function renderReportChart(state) {
  const report = getCurrentReport(state);
  const hasRows = state.reportDataKey === report.key && state.reportRows.length > 0;
  const chartModel = hasRows ? buildChartModel(getVisibleReportHeaders(state), state.reportRows) : null;
  const panel = $("#reportChartPanel");

  panel.hidden = !state.reportChartEnabled;
  panel.style.display = state.reportChartEnabled ? "" : "none";
  if (!state.reportChartEnabled) {
    return;
  }
  if (!hasRows) {
    panel.style.display = "";
    $("#reportChartMeta").textContent = "Najpierw załaduj dane raportu, aby zbudować wykres.";
    $("#reportChartContent").innerHTML = '<div class="available-card is-empty">Brak danych do wizualizacji.</div>';
    return;
  }
  if (!chartModel) {
    panel.style.display = "";
    $("#reportChartMeta").textContent = "Tego zestawu nie da się automatycznie zwizualizować na podstawie aktualnych kolumn.";
    $("#reportChartContent").innerHTML = '<div class="available-card is-empty">Nie znaleziono pary etykieta + wartość liczbową.</div>';
    return;
  }

  panel.style.display = "";
  $("#reportChartMeta").textContent = `Wykres oparty o kolumny „${chartModel.labelHeader}” i „${chartModel.valueHeader}”.`;
  $("#reportChartContent").innerHTML = chartMarkup(chartModel);
}

function startFavoriteCard(report) {
  return `
    <button type="button" class="start-card start-favorite-card" data-favorite-report="${escapeHtml(report.key)}">
      <span class="meta-label">${escapeHtml(report.section)}</span>
      <strong>${escapeHtml(report.title)}</strong>
      <p>${escapeHtml(report.question)}</p>
    </button>`;
}

function toggleFavoriteReport(state) {
  const report = getCurrentReport(state);
  const current = new Set(state.favoriteReports || []);
  if (current.has(report.key)) current.delete(report.key);
  else current.add(report.key);
  state.favoriteReports = [...current];
  persistFavoriteReports(state.favoriteReports);
  renderStartFavorites(state);
  renderReportActions(state);
}

function toggleReportChart(state) {
  state.reportChartEnabled = !state.reportChartEnabled;
  saveInteractiveReportState(state);
  renderReportActions(state);
  renderReportChart(state);
}

function toggleReportToolbarMenu(state, menuKey) {
  state.reportToolbarMenuOpen = state.reportToolbarMenuOpen === menuKey ? "" : menuKey;
  renderReportToolbar(state);
}

function closeReportToolbarMenus(state) {
  if (!state.reportToolbarMenuOpen) return;
  state.reportToolbarMenuOpen = "";
  renderReportToolbar(state);
}

async function exportActiveReport(state, format, includeChart) {
  const report = getCurrentReport(state);
  const visibleHeaders = getVisibleReportHeaders(state);
  const chartAllowed = includeChart && hasChartData(visibleHeaders, state.reportRows);
  const optimaSnippet = state.reportOptimaFilter?.primary?.expression || state.reportOptimaFilter?.secondary?.expression || "";
  const payload = {
    format,
    include_chart: chartAllowed,
    title: report.title,
    report_title: report.title,
    filter_label: describeTimeFilter(),
    headers: visibleHeaders,
    rows: state.reportDataKey === report.key ? state.reportRows : [],
    notes: [
      `Raport: ${report.title}`,
      `Sekcja: ${report.section}`,
      ...(optimaSnippet && optimaSnippet.length <= 600 ? [`Filtr do Optimy: ${optimaSnippet}`] : []),
      ...(state.reportNotes || []),
    ],
  };

  try {
    const result = await exportReportFile(payload);
    $("#reportActionMeta").textContent = `Przygotowano plik ${result.file_name}.`;
  } catch (error) {
    $("#reportActionMeta").textContent = `Błąd eksportu: ${error.message}`;
  }
}

function buildChartModel(headers, rows) {
  if (!headers.length || !rows.length) return null;
  const labelHeader = headers.find((header) => hasTextValues(header, rows)) || headers[0];
  const valueHeader = headers
    .filter((header) => header !== labelHeader)
    .sort((left, right) => numericScore(right, rows) - numericScore(left, rows))[0];
  if (!labelHeader || !valueHeader || numericScore(valueHeader, rows) === 0) return null;

  const grouped = new Map();
  rows.forEach((row) => {
    const label = String(row[labelHeader] ?? "").trim();
    if (!label) return;
    const value = coerceChartNumber(row[valueHeader]);
    if (value === null) return;
    grouped.set(label, (grouped.get(label) || 0) + value);
  });

  const points = [...grouped.entries()]
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, 8);
  if (!points.length) return null;

  return { labelHeader, valueHeader, points };
}

function chartMarkup(chartModel) {
  const maxValue = Math.max(...chartModel.points.map(([, value]) => Math.abs(value)), 1);
  return `
    <div class="report-chart-bars">
      ${chartModel.points.map(([label, value]) => {
        const width = Math.max(6, Math.round((Math.abs(value) / maxValue) * 100));
        return `
          <article class="report-chart-row">
            <div class="report-chart-label">${escapeHtml(label)}</div>
            <div class="report-chart-bar-track">
              <div class="report-chart-bar" style="width: ${width}%"></div>
            </div>
            <div class="report-chart-value">${escapeHtml(value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</div>
          </article>`;
      }).join("")}
    </div>`;
}

function hasChartData(headers, rows) {
  return Boolean(buildChartModel(headers, rows));
}

function hasTextValues(header, rows) {
  return rows.slice(0, 40).some((row) => {
    const value = String(row[header] ?? "").trim();
    return value && coerceChartNumber(value) === null;
  });
}

function numericScore(header, rows) {
  return rows.slice(0, 80).reduce((score, row) => (coerceChartNumber(row[header]) !== null ? score + 1 : score), 0);
}

function coerceChartNumber(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^[-+()0-9\s.,]+$/.test(text)) return null;
  const minusCount = (text.match(/-/g) || []).length;
  if (minusCount > 1) return null;
  if (minusCount === 1 && !text.startsWith("-")) return null;
  const parsed = parseAmount(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildMetricCards(report, state) {
  const availableCount = moduleCount(report.primaryModule, state.availableData);
  const relatedCount = report.relatedModules.length;

  return [
    { label: "Źródło główne", value: moduleLabel(report.primaryModule), tone: "info" },
    { label: "Rekordy w źródle", value: formatCount(availableCount), tone: availableCount > 0 ? "success" : "warning" },
    { label: "Powiązane moduły", value: formatCount(relatedCount), tone: "info" },
    { label: "Kontrole", value: formatCount(report.controls.length), tone: "info" },
    { label: "Alerty / blokady", value: formatCount(report.alerts.length), tone: report.priority === "Krytyczny" ? "critical" : "warning" },
    { label: "Filtr czasu", value: describeTimeFilter(), tone: "neutral" },
  ];
}

function metricCard(metric) {
  return `
    <article class="metric ${escapeHtml(metric.tone)}">
      <span>${escapeHtml(metric.label)}</span>
      <strong>${escapeHtml(metric.value)}</strong>
    </article>`;
}

function stackItem(text, tone) {
  return `
    <article class="stack-item stack-item-${escapeHtml(tone)}">
      <span>${escapeHtml(text)}</span>
    </article>`;
}

function renderSelectableStack(items, selections, tone) {
  return items.map((item, index) => {
    const id = `${tone}-${index}`;
    const checked = Boolean(selections?.[item]) ? " checked" : "";
    return `
      <label class="stack-choice stack-item stack-item-${escapeHtml(tone)}" for="${escapeHtml(id)}">
        <input id="${escapeHtml(id)}" type="checkbox" data-choice-type="${escapeHtml(tone)}" data-choice-value="${escapeHtml(item)}"${checked}>
        <span>${escapeHtml(item)}</span>
      </label>`;
  }).join("");
}

function renderSimpleSelectableStack(items, selections, tone) {
  return `
    <div class="simple-filter-list simple-filter-list-${escapeHtml(tone)}">
      ${items.map((item, index) => {
        const id = `${tone}-simple-${index}`;
        const checked = Boolean(selections?.[item]);
        return `
          <label class="simple-filter-option simple-filter-option-${escapeHtml(tone)}${checked ? " is-active" : ""}" for="${escapeHtml(id)}">
            <input id="${escapeHtml(id)}" type="checkbox" data-choice-type="${escapeHtml(tone)}" data-choice-value="${escapeHtml(item)}"${checked ? " checked" : ""}>
            <span>${escapeHtml(item)}</span>
          </label>`;
      }).join("")}
    </div>`;
}

function renderReportSelectionStack(report, items, selections, tone) {
  if (SIMPLE_STACK_FILTER_REPORTS.has(report?.key)) {
    return renderSimpleSelectableStack(items, selections, tone);
  }
  return renderSelectableStack(items, selections, tone);
}

function selectionFilterField(label) {
  return `__flag_${filterKey(label)}`;
}

const SELECTION_SUBJECT_DEFINITIONS = [
  ["kategoria", ["kategoria", "kategorii"]],
  ["kontrahent", ["kontrahent", "kontrahenta", "dostawca", "dostawcy", "odbiorca", "odbiorcy", "klient", "klienta", "podmiot", "podmiotu"]],
  ["stawka vat", ["stawka vat", "stawki vat", "vat"]],
  ["mpk", ["mpk"]],
  ["projekt", ["projekt", "projektu"]],
  ["schemat", ["schemat", "schematu"]],
  ["dekret", ["dekret", "dekretu", "dekretacja", "dekretacji"]],
  ["kurs", ["kurs", "kursu"]],
  ["akceptacja", ["akceptacja", "akceptacji"]],
  ["osoba akceptujaca", ["osoba akceptujaca", "osoby akceptujacej"]],
  ["opis", ["opis", "opisu", "opis merytoryczny"]],
  ["ksef", ["ksef", "numer ksef"]],
  ["nip", ["nip"]],
  ["kraj", ["kraj", "kraju"]],
  ["adres", ["adres", "adresu"]],
  ["rachunek bankowy", ["rachunek bankowy", "rachunku bankowego", "rachunek", "rachunku"]],
  ["czas pracy", ["czas pracy", "ewidencja czasu"]],
].map(([canonical, variants]) => ({
  canonical,
  variants: variants.map((variant) => normalizeText(variant).split(" ").filter(Boolean)),
}));

function rowHasSelectionFlag(row, label) {
  const value = String(row?.[selectionFilterField(label)] ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "tak" || value === "yes";
}

function applySelectionFiltersToRows(report, rows, state) {
  if (!SELECTION_FILTER_REPORTS.has(report?.key)) return rows;
  const selected = [...new Set([
    ...selectedTexts(state.reportControlSelections),
    ...selectedTexts(state.reportAlertSelections),
  ])];
  if (!selected.length) return rows;
  const headers = state.reportHeaders || [];
  return rows.filter((row) => selected.some((label) => rowMatchesSelectionCriterion(row, headers, label)));
}

function rowMatchesSelectionCriterion(row, headers, label) {
  const flagField = selectionFilterField(label);
  if (Object.prototype.hasOwnProperty.call(row || {}, flagField)) {
    return rowHasSelectionFlag(row, label);
  }

  if (rowMatchesMissingSelectionSubjects(row, headers, label)) return true;
  return rowMatchesTextualSelectionCriterion(row, headers, label);
}

function rowMatchesMissingSelectionSubjects(row, headers, label) {
  const subjects = extractMissingSelectionSubjects(label);
  if (!subjects.length) return false;
  return subjects.some((subject) => {
    const matchingHeaders = headersForFilter(subject, headers, [], { fallbackToAll: false });
    if (!matchingHeaders.length) return false;
    return matchingHeaders.some((header) => valueLooksMissing(row?.[header]));
  });
}

function extractMissingSelectionSubjects(label) {
  const tokens = normalizeText(label).split(" ").filter(Boolean);
  const subjects = [];
  const stopTokens = new Set(["wynika", "wymaga", "wymagaja", "spojrzec", "najpierw", "ocena", "pokazuje"]);
  for (let index = 0; index < tokens.length; index += 1) {
    if (!["brak", "bez"].includes(tokens[index])) continue;
    const segment = [];
    for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
      const token = tokens[cursor];
      if (["brak", "bez"].includes(token) || stopTokens.has(token)) break;
      segment.push(token);
    }
    subjects.push(...selectionSubjectsFromTokens(segment));
  }
  return [...new Set(subjects)];
}

function selectionSubjectsFromTokens(tokens) {
  const subjects = [];
  const separators = new Set(["lub", "oraz", "albo", "i", "czy", "z", "ze", "na", "do"]);
  for (let index = 0; index < tokens.length;) {
    if (separators.has(tokens[index])) {
      index += 1;
      continue;
    }
    const match = matchSelectionSubject(tokens, index);
    if (match) {
      subjects.push(match.canonical);
      index += match.length;
      continue;
    }
    index += 1;
  }
  return subjects;
}

function matchSelectionSubject(tokens, startIndex) {
  for (const subject of SELECTION_SUBJECT_DEFINITIONS) {
    for (const variant of subject.variants) {
      const matches = variant.every((token, offset) => tokens[startIndex + offset] === token);
      if (matches) return { canonical: subject.canonical, length: variant.length };
    }
  }
  return null;
}

function valueLooksMissing(value) {
  const normalized = normalizeText(value);
  return !normalized || ["brak", "nie dotyczy", "nd", "null", "none"].includes(normalized);
}

function rowMatchesTextualSelectionCriterion(row, headers, label) {
  const haystack = normalizeText(
    headers
      .filter((header) => !String(header || "").startsWith("__flag_"))
      .map((header) => `${header} ${row?.[header] ?? ""}`)
      .join(" "),
  );
  const keywords = selectionKeywordsForTextMatch(label);
  if (!keywords.length) return false;
  if (keywords.length === 1) return haystack.includes(keywords[0]);
  return keywords.filter((keyword) => haystack.includes(keyword)).length >= Math.min(2, keywords.length);
}

function selectionKeywordsForTextMatch(label) {
  return [...new Set(
    keywordsFromText(label).filter((keyword) => ![
      "oraz",
      "wedlug",
      "ktore",
      "ktorych",
      "lista",
      "raport",
      "dokument",
      "dokumenty",
      "faktura",
      "faktury",
      "ocena",
      "czy",
      "jest",
      "sa",
    ].includes(keyword)),
  )];
}

function renderLayoutEditor(state) {
  const headers = getLayoutHeaders(state);
  return headers.map((header, index) => {
    const checked = state.reportHiddenColumns?.[header] ? "" : " checked";
    const upDisabled = index === 0 ? " disabled" : "";
    const downDisabled = index === headers.length - 1 ? " disabled" : "";
    return `
        <div class="stack-layout-row stack-item stack-item-layout" data-layout-header="${escapeHtml(header)}">
        <label class="stack-layout-toggle">
          <input type="checkbox" data-layout-column="${escapeHtml(header)}"${checked}>
          <span>${escapeHtml(header)}</span>
        </label>
        <div class="stack-layout-actions">
          <button type="button" class="stack-layout-button" data-layout-target="${escapeHtml(header)}" data-layout-move="up" title="Przesuń kolumnę wyżej"${upDisabled}>↑</button>
          <button type="button" class="stack-layout-button" data-layout-target="${escapeHtml(header)}" data-layout-move="down" title="Przesuń kolumnę niżej"${downDisabled}>↓</button>
        </div>
      </div>`;
  }).join("");
}

function rememberControlSelections(state) {
  state.reportControlSelections = rememberSelectableValues("#reportControls");
  updateReportNarrativeMeta(state);
  saveInteractiveReportState(state);
}

function rememberAlertSelections(state) {
  state.reportAlertSelections = rememberSelectableValues("#reportAlerts");
  saveInteractiveReportState(state);
}

function rememberSelectableValues(containerSelector) {
  const result = {};
  document.querySelectorAll(`${containerSelector} [data-choice-value]`).forEach((input) => {
    result[input.dataset.choiceValue] = input.checked;
  });
  return result;
}

function rememberColumnVisibility(state) {
  const hidden = {};
  document.querySelectorAll("#reportLayoutList input[type='checkbox'][data-layout-column]").forEach((input) => {
    hidden[input.dataset.layoutColumn] = !input.checked;
  });
  state.reportHiddenColumns = hidden;
  ensureVisibleColumns(state);
  saveInteractiveReportState(state);
}

function moveReportColumn(state, header, direction) {
  syncReportLayoutState(state);
  const current = [...state.reportColumnOrder];
  const index = current.indexOf(header);
  if (index < 0) return;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= current.length) return;
  [current[index], current[target]] = [current[target], current[index]];
  state.reportColumnOrder = current;
  saveInteractiveReportState(state);
  $("#reportLayoutList").innerHTML = renderLayoutEditor(state);
  renderReportData(state);
}

function syncReportLayoutState(state) {
  const baseHeaders = getAvailableLayoutHeaders(state);
  if (!baseHeaders.length) {
    state.reportColumnOrder = [];
    state.reportHiddenColumns = {};
    return;
  }

  const ordered = state.reportColumnOrder.filter((header) => baseHeaders.includes(header));
  baseHeaders.forEach((header) => {
    if (!ordered.includes(header)) ordered.push(header);
  });
  state.reportColumnOrder = ordered;
  state.reportHiddenColumns = Object.fromEntries(
    Object.entries(state.reportHiddenColumns || {}).filter(([header]) => baseHeaders.includes(header)),
  );
  ensureVisibleColumns(state, ordered);
}

function ensureVisibleColumns(state, headers = state.reportColumnOrder || []) {
  if (!headers.length) return;
  const visible = headers.filter((header) => !state.reportHiddenColumns?.[header]);
  if (!visible.length) {
    state.reportHiddenColumns[headers[0]] = false;
  }
}

function getAvailableLayoutHeaders(state) {
  const report = getCurrentReport(state);
  const sourceHeaders = state.reportHeaders.length ? [...state.reportHeaders] : [...report.layout];
  return sourceHeaders.filter((header) => !String(header || "").startsWith("__flag_"));
}

function getLayoutHeaders(state) {
  syncReportLayoutState(state);
  return [...state.reportColumnOrder];
}

function getVisibleReportHeaders(state) {
  const headers = prioritizeHeadersForFocus(getLayoutHeaders(state), state);
  const visible = headers.filter((header) => !state.reportHiddenColumns?.[header]);
  return visible.length ? visible : headers.slice(0, 1);
}

function prioritizeHeadersForFocus(headers, state) {
  const focusTexts = [
    ...selectedTexts(state.reportControlSelections),
    ...selectedTexts(state.reportAlertSelections),
  ];
  if (!focusTexts.length) return headers;

  const scored = headers.map((header, index) => ({
    header,
    index,
    score: focusTexts.reduce((total, text) => total + scoreHeaderAgainstFocus(header, text), 0),
  }));
  return scored
    .sort((left, right) => (right.score - left.score) || (left.index - right.index))
    .map((item) => item.header);
}

function selectedTexts(selectionMap) {
  return Object.entries(selectionMap || {})
    .filter(([, active]) => active)
    .map(([text]) => text);
}

function selectedItemCount(selectionMap) {
  return selectedTexts(selectionMap).length;
}

function updateReportNarrativeMeta(state) {
  const report = getCurrentReport(state);
  $("#reportScopeMeta").textContent = `${selectedItemCount(state.reportControlSelections)} z ${report.controls.length} kontroli aktywne`;
}

function reportUsesEmbeddedHeaderFilters(report) {
  return Boolean(report && EMBEDDED_HEADER_FILTER_REPORTS.has(report.key));
}

function scoreHeaderAgainstFocus(header, text) {
  const normalizedHeader = normalizeText(header);
  const keywords = keywordsFromText(text);
  return keywords.reduce((score, keyword) => score + (normalizedHeader.includes(keyword) ? 1 : 0), 0);
}

function keywordsFromText(text) {
  const words = normalizeText(text).split(" ").filter((part) => part.length > 2);
  const extras = [];
  if (words.includes("vat")) extras.push("stawka", "kwota", "problem", "rekomendacja");
  if (words.includes("saldo")) extras.push("saldo", "kwota");
  if (words.some((word) => word.startsWith("walut")) || words.includes("kursu") || words.includes("waluta")) extras.push("waluta", "kurs");
  if (words.includes("bank")) extras.push("opis", "operacji", "konto");
  if (words.includes("platnosci") || words.includes("platnosc")) extras.push("status", "termin", "kwota");
  return [...new Set([...words, ...extras])];
}

function renderReportFilterControls(report, state) {
  const filterCard = $("#reportFilterCard");
  const useEmbeddedHeaders = reportUsesEmbeddedHeaderFilters(report);
  filterCard.hidden = useEmbeddedHeaders;
  if (useEmbeddedHeaders) {
    $("#reportFilterFields").innerHTML = "";
    updateReportFilterMeta(state);
    return;
  }
  const controls = report.filters.map((filter) => reportFilterControl(filter, state)).join("");
  $("#reportFilterFields").innerHTML = controls || '<div class="available-card is-empty">Ten raport nie ma dodatkowych filtrów.</div>';
  updateReportFilterMeta(state);
}

function reportFilterControl(filter, state) {
  const key = filterKey(filter);
  const type = filterControlType(filter);
  const value = state.reportFilterValues?.[key] || {};

  if (type === "date-link") {
    return `
      <button type="button" class="report-filter-link" data-focus-time-filter="true">
        <span>${escapeHtml(filter)}</span>
        <strong>${escapeHtml(describeTimeFilter())}</strong>
      </button>`;
  }

  if (type === "amount-range") {
    return `
      <div class="report-filter-field report-filter-field-range" data-report-filter="${escapeHtml(key)}" data-filter-label="${escapeHtml(filter)}" data-filter-type="amount-range">
        <span>${escapeHtml(filter)}</span>
        <input type="number" step="0.01" data-filter-part="min" value="${escapeHtml(value.min || "")}" placeholder="od">
        <input type="number" step="0.01" data-filter-part="max" value="${escapeHtml(value.max || "")}" placeholder="do">
      </div>`;
  }

  if (type === "select") {
    const options = selectOptionsForFilter(filter, state.reportRawRows || state.reportRows || [], state.reportHeaders || []);
    return `
      <label class="report-filter-field" data-report-filter="${escapeHtml(key)}" data-filter-label="${escapeHtml(filter)}" data-filter-type="select">
        ${escapeHtml(filter)}
        <select>
          <option value="">Wszystkie</option>
          ${options.map((option) => `<option value="${escapeHtml(option)}"${option === value.value ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
      </label>`;
  }

  if (type === "multiselect") {
    const selectedValues = new Set(value.values || []);
    const options = selectOptionsForFilter(filter, state.reportRawRows || state.reportRows || [], state.reportHeaders || []);
    return `
      <fieldset class="report-filter-field report-filter-field-multiselect" data-report-filter="${escapeHtml(key)}" data-filter-label="${escapeHtml(filter)}" data-filter-type="multiselect">
        <legend>${escapeHtml(filter)}</legend>
        <div class="report-filter-checkboxes">
          ${options.length
            ? options.map((option) => `
              <label class="report-filter-checkbox">
                <input type="checkbox" value="${escapeHtml(option)}"${selectedValues.has(option) ? " checked" : ""}>
                <span>${escapeHtml(option)}</span>
              </label>`).join("")
            : '<span class="muted">Brak wartości do wyboru.</span>'}
        </div>
      </fieldset>`;
  }

  return `
    <label class="report-filter-field" data-report-filter="${escapeHtml(key)}" data-filter-label="${escapeHtml(filter)}" data-filter-type="text">
      ${escapeHtml(filter)}
      <input type="text" value="${escapeHtml(value.value || "")}" placeholder="Wpisz fragment">
    </label>`;
}

function applyReportSpecificFilters(state) {
  rememberReportFilterValues(state);
  state.reportRows = filterReportRows(state, state.reportRawRows || []);
  setOptimaFilterLoading(state);
  renderReportData(state);
  refreshOptimaFilter(state);
}

function clearReportSpecificFilters(state) {
  state.reportFilterValues = {};
  renderReportFilterControls(getCurrentReport(state), state);
  state.reportRows = filterReportRows(state, state.reportRawRows || []);
  setOptimaFilterLoading(state);
  saveInteractiveReportState(state);
  renderReportData(state);
  refreshOptimaFilter(state);
}

function clearHeaderFilters(state) {
  const report = getCurrentReport(state);
  if (!reportUsesEmbeddedHeaderFilters(report)) return;
  const fields = [...document.querySelectorAll("#reportDataHead [data-report-filter]")];
  if (!fields.length) return;
  fields.forEach(clearSingleReportFilterField);
  state.reportFilterValues = {};
  applyReportSpecificFilters(state);
}

function clearSingleReportFilterField(field) {
  const type = field.dataset.filterType;
  if (type === "multiselect") {
    field.querySelectorAll("input[type='checkbox']").forEach((input) => {
      input.checked = false;
    });
    return;
  }

  field.querySelectorAll("select").forEach((select) => {
    select.value = "";
  });
  field.querySelectorAll("input").forEach((input) => {
    if (input.type === "checkbox") {
      input.checked = false;
      return;
    }
    input.value = "";
  });
}

function rememberReportFilterValues(state) {
  const values = {};
  document.querySelectorAll("#reportFilterFields [data-report-filter], #reportDataHead [data-report-filter]").forEach((field) => {
    const key = field.dataset.reportFilter;
    const type = field.dataset.filterType;
    const targetHeaders = (field.dataset.filterHeaders || "")
      .split("||")
      .map((header) => header.trim())
      .filter(Boolean);
    if (type === "amount-range") {
      values[key] = {
        type,
        label: field.dataset.filterLabel || "",
        min: field.querySelector("[data-filter-part='min']")?.value.trim() || "",
        max: field.querySelector("[data-filter-part='max']")?.value.trim() || "",
        headers: targetHeaders,
      };
      return;
    }
    if (type === "date-condition") {
      const operator = field.querySelector("[data-filter-part='operator']")?.value.trim() || "";
      const valueToInput = field.querySelector("[data-filter-part='value-to']");
      if (valueToInput) valueToInput.disabled = operator !== "between";
      values[key] = {
        type,
        label: field.dataset.filterLabel || "",
        operator,
        value: field.querySelector("[data-filter-part='value']")?.value.trim() || "",
        valueTo: valueToInput?.value.trim() || "",
        headers: targetHeaders,
      };
      return;
    }
    if (type === "number-condition") {
      const operator = field.querySelector("[data-filter-part='operator']")?.value.trim() || "";
      const valueToInput = field.querySelector("[data-filter-part='value-to']");
      if (valueToInput) valueToInput.disabled = operator !== "between";
      values[key] = {
        type,
        label: field.dataset.filterLabel || "",
        operator,
        value: field.querySelector("[data-filter-part='value']")?.value.trim() || "",
        valueTo: valueToInput?.value.trim() || "",
        headers: targetHeaders,
      };
      return;
    }
    if (type === "multiselect") {
      values[key] = {
        type,
        label: field.dataset.filterLabel || "",
        values: [...field.querySelectorAll("input[type='checkbox']:checked")].map((input) => input.value.trim()).filter(Boolean),
        headers: targetHeaders,
      };
      return;
    }
    const input = field.querySelector("input, select");
    values[key] = {
      type,
      label: field.dataset.filterLabel || "",
      value: input?.value.trim() || "",
      headers: targetHeaders,
    };
  });
  state.reportFilterValues = values;
  saveInteractiveReportState(state);
  updateReportFilterMeta(state);
}

function filterReportRows(state, rows) {
  const filters = Object.values(state.reportFilterValues || {}).filter(filterValueIsActive);
  const filteredByHeaders = filters.length
    ? rows.filter((row) => filters.every((filter) => rowMatchesReportFilter(row, state.reportHeaders, filter)))
    : [...rows];
  return applySelectionFiltersToRows(getCurrentReport(state), filteredByHeaders, state);
}

function rowMatchesReportFilter(row, headers, filter) {
  if (filter.type === "amount-range") {
    const min = filter.min === "" ? null : Number(filter.min);
    const max = filter.max === "" ? null : Number(filter.max);
    const amountHeaders = filter.headers?.length ? filter.headers : headers.filter(isAmountHeader);
    return amountHeaders.some((header) => {
      const value = coerceChartNumber(row[header]);
      if (value === null) return false;
      if (min !== null && value < min) return false;
      if (max !== null && value > max) return false;
      return true;
    });
  }

  if (filter.type === "date-condition") {
    const operator = filter.operator || "";
    if (!operator) return true;
    const value = normalizeDateFilterValue(filter.value);
    const valueTo = normalizeDateFilterValue(filter.valueTo);
    const matchingHeaders = headersForFilter(filter.label, headers, filter.headers);
    return matchingHeaders.some((header) => {
      const rowValue = normalizeDateFilterValue(row[header]);
      if (!rowValue) return false;
      switch (operator) {
        case "eq":
          return Boolean(value) && rowValue === value;
        case "gt":
          return Boolean(value) && rowValue > value;
        case "gte":
          return Boolean(value) && rowValue >= value;
        case "lt":
          return Boolean(value) && rowValue < value;
        case "lte":
          return Boolean(value) && rowValue <= value;
        case "between":
          if (!value && !valueTo) return true;
          if (value && rowValue < value) return false;
          if (valueTo && rowValue > valueTo) return false;
          return true;
        default:
          return true;
      }
    });
  }

  if (filter.type === "number-condition") {
    const operator = filter.operator || "";
    if (!operator) return true;
    const value = filter.value === "" ? null : Number(filter.value);
    const valueTo = filter.valueTo === "" ? null : Number(filter.valueTo);
    const matchingHeaders = headersForFilter(filter.label, headers, filter.headers);
    return matchingHeaders.some((header) => {
      const numeric = coerceChartNumber(row[header]);
      if (numeric === null) return false;
      switch (operator) {
        case "eq":
          return value !== null && numeric === value;
        case "gt":
          return value !== null && numeric > value;
        case "gte":
          return value !== null && numeric >= value;
        case "lt":
          return value !== null && numeric < value;
        case "lte":
          return value !== null && numeric <= value;
        case "between":
          if (value === null && valueTo === null) return true;
          if (value !== null && numeric < value) return false;
          if (valueTo !== null && numeric > valueTo) return false;
          return true;
        default:
          return true;
      }
    });
  }

  if (filter.type === "multiselect") {
    const selectedValues = (filter.values || []).map((value) => normalizeText(value)).filter(Boolean);
    if (!selectedValues.length) return true;
    const matchingHeaders = headersForFilter(filter.label, headers, filter.headers);
    return matchingHeaders.some((header) => selectedValues.includes(normalizeText(row[header] ?? "")));
  }

  const needle = String(filter.value || "").toLowerCase();
  if (!needle) return true;
  const matchingHeaders = headersForFilter(filter.label, headers, filter.headers);
  return matchingHeaders.some((header) => String(row[header] ?? "").toLowerCase().includes(needle));
}

function filterValueIsActive(filter) {
  if (!filter) return false;
  if (filter.type === "amount-range") return filter.min !== "" || filter.max !== "";
  if (filter.type === "date-condition") {
    if (!filter.operator) return false;
    if (filter.operator === "between") return filter.value !== "" || filter.valueTo !== "";
    return filter.value !== "";
  }
  if (filter.type === "number-condition") {
    if (!filter.operator) return false;
    if (filter.operator === "between") return filter.value !== "" || filter.valueTo !== "";
    return filter.value !== "";
  }
  if (filter.type === "multiselect") return Boolean(filter.values?.length);
  return Boolean(filter.value);
}

function updateReportFilterMeta(state) {
  const active = Object.values(state.reportFilterValues || {}).filter(filterValueIsActive).length;
  const source = state.reportRawRows?.length || 0;
  const visible = state.reportRows?.length || 0;
  const suffix = source ? `, widoczne ${visible.toLocaleString("pl-PL")} z ${source.toLocaleString("pl-PL")}` : "";
  $("#reportFilterMeta").textContent = active ? `Filtry raportu: ${active} aktywne${suffix}` : `Filtry raportu: brak${suffix}`;
}

function renderReportFilterIndicator(state) {
  const report = getCurrentReport(state);
  const button = $("#reportTableFilterToggle");
  if (!button) return;

  const supportsHeaderFilters = reportHasRenderedHeaderFilters(state, report);
  const activeCount = Object.values(state.reportFilterValues || {}).filter(filterValueIsActive).length;
  button.hidden = !supportsHeaderFilters;
  button.disabled = !supportsHeaderFilters;
  button.classList.toggle("is-active", activeCount > 0);
  button.classList.toggle("is-inactive", activeCount === 0);
  button.setAttribute("aria-pressed", activeCount > 0 ? "true" : "false");
  button.setAttribute("aria-label", activeCount > 0 ? `Aktywne filtry nagłówków: ${activeCount}. Kliknij, aby wyczyścić wszystkie.` : "Brak aktywnych filtrów nagłówków");
  button.title = activeCount > 0 ? `Aktywne filtry: ${activeCount}. Kliknij, aby wyczyścić wszystkie.` : "Brak aktywnych filtrów nagłówków";
}

function reportHasRenderedHeaderFilters(state, report) {
  if (!reportUsesEmbeddedHeaderFilters(report)) return false;
  if (state.reportDataStatus !== "ready" || state.reportDataKey !== report?.key) return false;
  const headers = getVisibleReportHeaders(state);
  if (!headers.length) return false;
  return embeddedHeaderFiltersForReport(report, headers).length > 0;
}

function filterControlType(filter) {
  const normalized = normalizeText(filter);
  if (normalized.includes("okres") || normalized.includes("data") || normalized.includes("typ daty")) return "date-link";
  if (normalized.includes("kwota") || normalized.includes("suma") || normalized.includes("wartosc")) return "amount-range";
  if (normalized.includes("budowa")) return "multiselect";
  if (normalized.includes("status") || normalized.includes("typ dokumentu") || normalized.includes("waluta") || normalized.includes("priorytet")) return "select";
  return "text";
}

function selectOptionsForFilter(filter, rows, headers) {
  const matchingHeaders = headersForFilter(filter, headers);
  return selectOptionsForHeaders(matchingHeaders, rows);
}

function selectOptionsForHeaders(targetHeaders, rows) {
  const options = new Set();
  rows.forEach((row) => {
    targetHeaders.forEach((header) => {
      const value = String(row[header] ?? "").trim();
      if (value && value.length <= 80) options.add(value);
    });
  });
  return [...options].sort((left, right) => left.localeCompare(right, "pl"));
}

function headersForFilter(filter, headers, exactHeaders = [], { fallbackToAll = true } = {}) {
  if (exactHeaders?.length) {
    const matchingExactHeaders = exactHeaders.filter((header) => headers.includes(header));
    if (matchingExactHeaders.length) return matchingExactHeaders;
  }
  const normalizedFilter = normalizeText(filter);
  const aliases = [
    ["budowa", ["budowa", "konto budowy", "realizacja", "miejsce realizacji"]],
    ["kontrahent", ["kontrahent", "dostawca", "odbiorca", "podmiot", "klient"]],
    ["status platnosci", ["status platnosci", "status", "rozliczono"]],
    ["status ksiegowy", ["status ksiegowy", "status", "bufor"]],
    ["status vat", ["status vat", "status", "vat"]],
    ["status ksef", ["status ksef", "ksef", "status"]],
    ["status", ["status"]],
    ["typ dokumentu", ["typ dokumentu", "typ"]],
    ["typ blokady", ["typ blokady", "blokada", "problem"]],
    ["priorytet", ["priorytet"]],
    ["waluta", ["waluta"]],
    ["nip", ["nip"]],
    ["konto", ["konto"]],
    ["kategoria", ["kategoria"]],
    ["mpk", ["mpk"]],
    ["projekt", ["projekt"]],
    ["zadanie", ["zadanie"]],
    ["osoba", ["osoba", "operator", "odpowiedzialny"]],
    ["pracownik", ["pracownik", "nazwisko", "imie"]],
  ];
  const matched = aliases.find(([name]) => normalizedFilter.includes(name));
  const needles = matched ? matched[1] : normalizedFilter.split(" ").filter((part) => part.length > 2);
  const result = headers.filter((header) => {
    const normalizedHeader = normalizeText(header);
    return needles.some((needle) => normalizedHeader.includes(needle));
  });
  return result.length ? result : (fallbackToAll ? headers : []);
}

function isAmountHeader(header) {
  const normalized = normalizeText(header);
  return ["kwota", "brutto", "netto", "vat", "suma", "wartosc", "saldo", "wplyw", "wydatek", "koszt"].some((part) => normalized.includes(part));
}

function normalizeDateFilterValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return isoMatch[0];
  const dottedMatch = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dottedMatch) return `${dottedMatch[3]}-${dottedMatch[2]}-${dottedMatch[1]}`;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function filterKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getCurrentReport(state) {
  return REPORTS_BY_KEY[state.currentReportKey] || REPORTS[0];
}

function moduleLabel(code) {
  return MODULE_LABELS[code] || code || "Wieloźródłowy";
}

function moduleCount(code, modules) {
  return Number((modules || []).find((item) => item.code === code)?.record_count || 0);
}

function clearOptimaFilterState(state) {
  state.reportOptimaFilter = null;
  state.reportOptimaFilterStatus = "idle";
  state.reportOptimaFilterError = "";
}

function setOptimaFilterLoading(state) {
  state.reportOptimaFilter = null;
  state.reportOptimaFilterStatus = "loading";
  state.reportOptimaFilterError = "";
}

async function refreshOptimaFilter(state) {
  const report = getCurrentReport(state);
  if (!$("#sqlDatabase").value.trim() || state.reportDataKey !== report.key || !state.reportRows.length) {
    clearOptimaFilterState(state);
    renderOptimaFilter(state);
    return;
  }

  const expectedReportKey = report.key;
  const expectedRowCount = state.reportRows.length;
  state.reportOptimaFilterStatus = "loading";
  state.reportOptimaFilterError = "";
  renderOptimaFilter(state);

  try {
    const response = await fetch("/api/optima-filter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report: report.queryKey,
        report_title: report.title,
        module: state.reportSource?.module || report.primaryModule,
        headers: state.reportHeaders,
        rows: state.reportRows,
      }),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "Nie udało się zbudować filtra do Optimy.");
    if (state.currentReportKey !== expectedReportKey || state.reportRows.length !== expectedRowCount) return;
    state.reportOptimaFilter = payload;
    state.reportOptimaFilterStatus = "ready";
    renderOptimaFilter(state);
  } catch (error) {
    if (state.currentReportKey !== expectedReportKey) return;
    state.reportOptimaFilter = null;
    state.reportOptimaFilterStatus = "error";
    state.reportOptimaFilterError = error.message;
    renderOptimaFilter(state);
  }
}

async function copyOptimaExpression(button) {
  const text = String(button.dataset.copyOptima || "").trim();
  if (!text) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      copyTextFallback(text);
    }
    $("#reportOptimaMeta").textContent = "Warunek do Optimy skopiowany do schowka.";
  } catch (_error) {
    copyTextFallback(text);
    $("#reportOptimaMeta").textContent = "Warunek do Optimy skopiowany przez tryb awaryjny.";
  }
}

function copyTextFallback(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "readonly");
  area.style.position = "absolute";
  area.style.left = "-9999px";
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

function activeModuleCount(modules) {
  return (modules || []).filter((item) => Number(item.record_count || 0) > 0).length;
}

function formatCount(value) {
  if (typeof value === "string") return value;
  return Number(value || 0).toLocaleString("pl-PL");
}

function reportUsesModule(report, code) {
  return Boolean(report?.relatedModules?.includes(code));
}

function rankModuleForReport(item, report) {
  if (!report) return 0;
  if (item.code === report.primaryModule) return 3;
  if (reportUsesModule(report, item.code)) return 2;
  return 1;
}
