import { $, escapeHtml } from "./utils.js";

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
        sources: ["Optima", "KSeF", "Bank", "OCR", "Excel"],
        filters: ["Okres od-do", "Źródło danych", "Data importu", "Typ dokumentu", "Status księgowania"],
        tags: ["raport nadrzędny", "po imporcie", "status paczki"],
        primaryModule: "DOCUMENTS",
        relatedModules: ["DOCUMENTS", "LEDGER", "VAT_PURCHASE", "VAT_SALE", "SETTLEMENTS"],
        controls: [
          "Liczba dokumentów i suma netto, VAT oraz brutto.",
          "Dokumenty poprawne, z błędami, bez schematu i bez dekretu.",
          "Dokumenty do ręcznej weryfikacji i status gotowości paczki.",
        ],
        layout: ["Nazwa paczki", "Źródło", "Okres od-do", "Data importu", "Liczba dokumentów", "Suma brutto", "Status paczki"],
        alerts: ["Brakuje danych źródłowych.", "Paczka zawiera dużo dokumentów bez schematu.", "Paczka nie przeszła kontroli technicznej."],
      },
      {
        key: "closing-blockers",
        title: "Blokady zamknięcia miesiąca",
        section: "Paczki i zamknięcie",
        summary: "Raport blokad podzielonych na techniczne, księgowe, schematowe, VAT, KSeF, rozrachunkowe, merytoryczne i zarządcze.",
        question: "Co dokładnie blokuje zamknięcie miesiąca i kto powinien usunąć blokadę?",
        priority: "Krytyczny",
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
        sources: ["Optima", "KSeF", "Bank"],
        filters: ["Okres od-do", "Priorytet", "Odpowiedzialny", "Status księgowy", "Status KSeF"],
        tags: ["operacyjny", "kolejka pracy", "priorytety"],
        primaryModule: "DOCUMENTS",
        relatedModules: ["DOCUMENTS", "LEDGER", "BANK", "SETTLEMENTS"],
        controls: [
          "Priorytet problemu: krytyczny, wysoki, średni.",
          "Dokumenty bez schematu, bez dekretu, bez KSeF i bez MPK.",
          "Przypisanie odpowiedzialnego i statusu obsługi.",
        ],
        layout: ["Priorytet", "Dokument", "Typ", "Kontrahent", "Kwota", "Problem", "Odpowiedzialny", "Status"],
        alerts: ["Brak schematu i dekretu.", "Płatność nierozpoznana.", "Brak MPK lub opisu merytorycznego."],
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
        sources: ["Optima"],
        filters: ["Okres od-do", "Typ dokumentu", "Kategoria", "Kontrahent", "Powód braku schematu"],
        tags: ["brak schematu", "obsługa ręczna", "powód"],
        primaryModule: "DOCUMENTS",
        relatedModules: ["DOCUMENTS", "LEDGER", "ACCOUNT_PLAN"],
        controls: [
          "Brak kategorii, kontrahenta, stawki VAT, MPK lub projektu.",
          "Nietypowy typ dokumentu, korekta, dokument walutowy lub środek trwały.",
          "Ocena, czy brak wynika z danych czy z konfiguracji schematu.",
        ],
        layout: ["Data", "Typ dokumentu", "Numer", "Kontrahent", "Netto", "VAT", "Brutto", "Kategoria", "Powód braku schematu"],
        alerts: ["Brak kategorii.", "Brak kontrahenta.", "Brak MPK lub stawki VAT."],
      },
      {
        key: "scheme-without-entry",
        title: "Schemat ze wskazaniem, ale bez dekretu",
        section: "Schematy i dekretacja",
        summary: "Lista dokumentów mających schemat, ale bez wygenerowanego dekretu.",
        question: "Dlaczego schemat jest przypisany, ale nie wygenerował księgowania?",
        priority: "Krytyczny",
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
  group.reports.map((report) => ({ ...report, groupId: group.id, groupTitle: group.title })),
);

const REPORTS_BY_KEY = Object.fromEntries(REPORTS.map((report) => [report.key, report]));
const REPORT_GROUPS_BY_ID = Object.fromEntries(REPORT_GROUPS.map((group) => [group.id, group]));
const SIDEBAR_GROUP_IDS = REPORT_GROUPS.map((group) => group.id);
const DATABASE_STORAGE_KEY = "optimaAudit.connectedDatabase";

export function initApp(state) {
  renderSideMenu(state);
  bindEvents(state);
  renderActiveReport(state);
  renderReportData(state);
  renderCurrentView(state);
  updateTimeFilterMeta();
  updateBadges(state);
  restoreKnownDatabase(state);
}

function bindEvents(state) {
  $("#scanBackups").addEventListener("click", () => scanBackups(state));
  $("#connectBackup").addEventListener("click", () => connectBackup(state));
  $("#refreshDataCatalogPanel").addEventListener("click", () => loadAvailableData(state));
  $("#refreshReportData").addEventListener("click", () => loadActiveReportData(state));
  $("#applyReportTimeFilter").addEventListener("click", () => applyReportTimeFilter(state));
  $("#clearReportTimeFilters").addEventListener("click", () => clearTimeFilters(state));
  $("#sqlDatabase").addEventListener("change", () => {
    persistDatabase($("#sqlDatabase").value.trim());
    updateBadges(state);
    loadAvailableYears(state);
    loadAvailableData(state);
    renderActiveReport(state);
    loadActiveReportData(state);
  });
  $("#applyTimeFilter").addEventListener("click", () => applyTimeFilter(state));
  $("#clearTimeFilters").addEventListener("click", () => clearTimeFilters(state));
  ["#filterYear", "#filterMonth", "#filterDateFrom", "#filterDateTo"].forEach((selector) => {
    $(selector).addEventListener("change", () => syncReportFiltersFromTopbar());
    $(selector).addEventListener("input", () => syncReportFiltersFromTopbar());
  });
  ["#reportFilterYear", "#reportFilterMonth", "#reportFilterDateFrom", "#reportFilterDateTo"].forEach((selector) => {
    $(selector).addEventListener("change", () => syncTopbarFiltersFromReport());
    $(selector).addEventListener("input", () => syncTopbarFiltersFromReport());
  });
  $("#sideMenu").addEventListener("click", (event) => {
    const viewItem = event.target.closest("[data-view-key]");
    if (viewItem) {
      selectView(state, viewItem.dataset.viewKey);
      return;
    }

    const groupItem = event.target.closest("[data-report-group]");
    if (groupItem) {
      const firstReport = REPORT_GROUPS_BY_ID[groupItem.dataset.reportGroup]?.reports?.[0];
      if (firstReport) selectReport(state, firstReport.key);
      return;
    }

    const reportItem = event.target.closest("[data-report-key]");
    if (reportItem) selectReport(state, reportItem.dataset.reportKey);
  });
}

function selectView(state, viewKey) {
  if (viewKey === "report") {
    state.currentView = "report";
    renderSideMenu(state);
    renderCurrentView(state);
    renderActiveReport(state);
    updateBadges(state);
    loadActiveReportData(state);
    return;
  }

  state.currentView = viewKey === "communication" ? "communication" : "start";
  renderSideMenu(state);
  renderCurrentView(state);
  updateBadges(state);
}

function selectReport(state, reportKey) {
  if (!REPORTS_BY_KEY[reportKey]) return;
  state.currentView = "report";
  state.currentReportKey = reportKey;
  clearReportData(state);
  renderSideMenu(state);
  renderCurrentView(state);
  renderActiveReport(state);
  updateBadges(state);
  loadActiveReportData(state);
}

async function restoreKnownDatabase(state) {
  const restored = await ensureDatabaseAvailable(state);
  if (restored) await loadActiveReportData(state);
}

async function ensureDatabaseAvailable(state) {
  if ($("#sqlDatabase").value.trim()) return true;
  const storedDatabase = readStoredDatabase();
  const detectedDatabase = storedDatabase || await detectLatestDatabase();
  if (!detectedDatabase || $("#sqlDatabase").value.trim()) return Boolean($("#sqlDatabase").value.trim());

  $("#sqlDatabase").value = detectedDatabase;
  persistDatabase(detectedDatabase);
  $("#backupMeta").textContent = `Status: używam bazy ${detectedDatabase}.`;
  $("#backupInfo").textContent = `Status: aktywna baza SQL.\nBaza: ${detectedDatabase}`;
  updateBadges(state);
  await loadAvailableYears(state);
  await loadAvailableData(state);
  return true;
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

async function scanBackups(state) {
  const directory = $("#backupDirectory").value.trim();
  $("#backupPath").value = "";
  $("#connectBackup").disabled = true;
  $("#backupMeta").textContent = "Status: szukam pliku .BAK/.BAC w wybranym katalogu...";
  $("#backupInfo").textContent = "Status: skanowanie katalogu.";
  try {
    const query = directory ? `?root=${encodeURIComponent(directory)}` : "";
    const response = await fetch(`/api/backups${query}`);
    const payload = await response.json();
    state.backups = payload.backups || [];
    selectNewestBackup(state.backups);
  } catch (error) {
    $("#backupMeta").textContent = `Status: błąd wgrywania pliku: ${error.message}`;
    $("#backupInfo").textContent = `Status: błąd - ${error.message}`;
  }
}

function selectNewestBackup(backups) {
  const selected = backups[0];
  if (!selected) {
    $("#backupMeta").textContent = "Status: nie znaleziono pliku .BAK/.BAC w tym katalogu.";
    $("#backupInfo").textContent = "Status: brak backupu do podłączenia.";
    return;
  }
  $("#backupPath").value = selected.path;
  $("#connectBackup").disabled = false;
  $("#backupMeta").textContent = `Status: wybrano ${selected.name} (${selected.size_mb} MB).`;
  $("#backupInfo").textContent = `Status: plik gotowy do podłączenia.\nPlik: ${selected.path}`;
}

async function connectBackup(state) {
  const path = $("#backupPath").value.trim();
  const previousDatabase = $("#sqlDatabase").value.trim();
  if (!path) {
    $("#backupMeta").textContent = "Status: najpierw kliknij „Wgraj plik” i wybierz backup.";
    $("#backupInfo").textContent = "Status: brak wybranego pliku backupu.";
    return;
  }
  $("#backupMeta").textContent = "Status: sprawdzam backup...";
  $("#backupInfo").textContent = "Status: sprawdzam strukturę backupu.";
  $("#connectBackup").disabled = true;
  try {
    const inspected = await inspectSelectedBackup(path);
    const request = {
      path,
      server: $("#sqlServer").value.trim(),
      target_database: inspected.suggested_database || $("#sqlDatabase").value.trim(),
    };
    $("#backupMeta").textContent = "Status: podłączam bazę read-only. To może potrwać...";
    $("#backupInfo").textContent = `Status: odtwarzam kopię read-only.\nBaza: ${request.target_database}`;
    const response = await fetch("/api/connect-backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "Nie udało się podłączyć backupu.");
    $("#sqlDatabase").value = payload.database;
    persistDatabase(payload.database);
    $("#backupMeta").textContent = `Status: podłączono bazę ${payload.database}.`;
    $("#backupInfo").textContent = `Status: podłączono bazę read-only.\nBaza: ${payload.database}\nPlik: ${payload.source_path}`;
    updateBadges(state);
    updateTimeFilterMeta();
    await loadAvailableYears(state);
    await loadAvailableData(state);
    await loadActiveReportData(state);
  } catch (error) {
    $("#sqlDatabase").value = previousDatabase;
    persistDatabase(previousDatabase);
    updateBadges(state);
    renderActiveReport(state);
    if (!previousDatabase) renderNoDatabase(state);
    $("#backupMeta").textContent = `Status: błąd podłączenia - ${error.message}`;
    $("#backupInfo").textContent = `Status: błąd - ${error.message}`;
  } finally {
    $("#connectBackup").disabled = !$("#backupPath").value.trim();
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
    ...getTimeFilterPayload(),
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
    });
    const response = await fetch(`/api/years?${query.toString()}`);
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "Nie udało się pobrać lat z bazy.");

    state.availableYears = (payload.years || []).map((year) => String(year));
    const selectedYear = state.availableYears.includes(currentYear)
      ? currentYear
      : defaultYearFromDatabase(state.availableYears);
    renderYearOptions(state, selectedYear);
    updateTimeFilterMeta();
  } catch (_error) {
    state.availableYears = [];
    renderYearOptions(state, currentYear);
  }
}

function renderYearOptions(state, selectedYear) {
  const years = state.availableYears || [];
  const fallback = selectedYear && !years.includes(selectedYear) ? [selectedYear] : [];
  const options = ["", ...fallback, ...years];
  const html = options.map((year) => {
    const label = year ? year : "Wszystkie lata";
    const selected = year === selectedYear ? " selected" : "";
    return `<option value="${escapeHtml(year)}"${selected}>${escapeHtml(label)}</option>`;
  }).join("");
  $("#filterYear").innerHTML = html;
  $("#reportFilterYear").innerHTML = html;
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
  if (!report?.queryKey) {
    clearReportData(state);
    state.reportDataStatus = "unsupported";
    renderReportData(state);
    return;
  }
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

  const request = {
    report: report.queryKey,
    server: $("#sqlServer").value.trim(),
    database: $("#sqlDatabase").value.trim(),
    ...getTimeFilterPayload(),
  };

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
    state.reportHeaders = payload.headers || [];
    state.reportRows = payload.rows || [];
    state.reportDataStatus = "ready";
    state.reportDataKey = report.key;
    renderReportData(state);
  } catch (error) {
    state.reportHeaders = [];
    state.reportRows = [];
    state.reportDataStatus = "error";
    state.reportDataError = error.message;
    state.reportDataKey = report.key;
    renderReportData(state);
  }
}

function clearReportData(state) {
  state.reportHeaders = [];
  state.reportRows = [];
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
  const databaseName = $("#sqlDatabase").value.trim() || "Brak podłączonej bazy";
  const report = getCurrentReport(state);
  const view = state.currentView || "start";
  $("#connectedDatabaseName").textContent = databaseName;
  $("#recordBadge").textContent = `Źródła: ${activeModuleCount(state.availableData)}`;
  if (view === "communication") {
    $("#selectedReportBadge").textContent = "Widok: Komunikacja";
    $("#viewSubtitle").textContent = "Podłącz backup SQL i sprawdź listę pewnych danych wykrytych w bazie.";
    return;
  }
  if (view === "report") {
    $("#selectedReportBadge").textContent = `Raport: ${report?.title || "Brak raportu"}`;
    $("#viewSubtitle").textContent = report?.question || "Wybierz raport z menu po lewej.";
    return;
  }
  $("#selectedReportBadge").textContent = "Widok: START";
  $("#viewSubtitle").textContent = "Strona startowa: wybierz Komunikację albo przejdź do jednej z grup raportów.";
}

async function applyTimeFilter(state) {
  updateTimeFilterMeta();
  syncReportFiltersFromTopbar();
  await loadAvailableData(state);
  await loadActiveReportData(state);
}

async function applyReportTimeFilter(state) {
  syncTopbarFiltersFromReport();
  await applyTimeFilter(state);
}

async function clearTimeFilters(state) {
  $("#filterYear").value = defaultYearFromDatabase(state.availableYears || []);
  $("#filterMonth").value = defaultMonthValue();
  $("#filterDateFrom").value = "";
  $("#filterDateTo").value = "";
  await applyTimeFilter(state);
}

function getTimeFilterPayload() {
  const year = $("#filterYear").value.trim();
  const month = $("#filterMonth").value;
  const dateFrom = $("#filterDateFrom").value;
  const dateTo = $("#filterDateTo").value;

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

function updateTimeFilterMeta() {
  const description = describeTimeFilter();
  $("#timeFilterMeta").textContent = `Filtr: ${description}`;
  $("#reportFilterMeta").textContent = `Aktywny filtr: ${description}`;
}

function syncReportFiltersFromTopbar() {
  $("#reportFilterYear").value = $("#filterYear").value;
  $("#reportFilterMonth").value = $("#filterMonth").value;
  $("#reportFilterDateFrom").value = $("#filterDateFrom").value;
  $("#reportFilterDateTo").value = $("#filterDateTo").value;
  updateTimeFilterMeta();
}

function syncTopbarFiltersFromReport() {
  $("#filterYear").value = $("#reportFilterYear").value;
  $("#filterMonth").value = $("#reportFilterMonth").value;
  $("#filterDateFrom").value = $("#reportFilterDateFrom").value;
  $("#filterDateTo").value = $("#reportFilterDateTo").value;
  updateTimeFilterMeta();
}

function describeTimeFilter() {
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
  return "bez ograniczenia dat";
}

function renderSideMenu(state) {
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
    ["report", "#viewReport"],
  ].forEach(([viewKey, selector]) => {
    $(selector).classList.toggle("is-active", viewKey === activeView);
  });
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
  return `
    <section class="side-menu-group${groupActive ? " is-active" : ""}">
      <button type="button" class="side-menu-group-head" data-report-group="${escapeHtml(group.id)}">
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

  $("#reportSection").textContent = report.section;
  $("#reportTitle").textContent = report.title;
  $("#reportSummary").textContent = report.summary;
  $("#reportQuestion").textContent = report.question;
  $("#reportSources").textContent = report.sources.join(", ");
  renderReportFilterChips(report);
  syncReportFiltersFromTopbar();
  $("#reportPriority").textContent = `Priorytet: ${report.priority.toLowerCase()}`;
  $("#reportPriority").dataset.priority = report.priority.toLowerCase();
  $("#reportScopeMeta").textContent = `${report.controls.length} kontroli, ${report.layout.length} sekcji raportu`;
  $("#reportTags").innerHTML = report.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  $("#reportControls").innerHTML = report.controls.map((item) => stackItem(item, "control")).join("");
  $("#reportLayoutList").innerHTML = report.layout.map((item) => stackItem(item, "layout")).join("");
  $("#reportAlerts").innerHTML = report.alerts.map((item) => stackItem(item, "alert")).join("");
  $("#reportMetrics").innerHTML = buildMetricCards(report, state).map(metricCard).join("");
  renderReportData(state);
  updateBadges(state);
}

function renderReportData(state) {
  const report = getCurrentReport(state);
  const status = state.reportDataStatus;
  const rowsBelongToReport = state.reportDataKey === report.key;
  $("#refreshReportData").disabled = !report?.queryKey || !$("#sqlDatabase").value.trim() || status === "loading";

  if (!report?.queryKey) {
    $("#reportDataMeta").textContent = "Ten raport ma zdefiniowany sens i układ, ale nie ma jeszcze podpiętego zapytania SQL.";
    renderReportTable([], [], "Dane szczegółowe dla tego raportu będą podpinane etapami.");
    return;
  }
  if (!$("#sqlDatabase").value.trim()) {
    $("#reportDataMeta").textContent = "Podłącz bazę, żeby zobaczyć konkretne dokumenty z raportu.";
    renderReportTable([], [], "Najpierw podłącz bazę SQL.");
    return;
  }
  if (status === "loading") {
    $("#reportDataMeta").textContent = `Pobieram wyniki raportu „${report.title}” dla filtra: ${describeTimeFilter()}.`;
    renderReportTable([], [], "Pobieram dane z SQL...");
    return;
  }
  if (status === "error" && rowsBelongToReport) {
    $("#reportDataMeta").textContent = `Błąd pobierania raportu: ${state.reportDataError || "nieznany błąd"}`;
    renderReportTable([], [], "Nie udało się pobrać wyników raportu.");
    return;
  }
  if (!rowsBelongToReport) {
    $("#reportDataMeta").textContent = "Raport ma podpięte zapytanie SQL.";
    renderReportTable([], [], "Kliknij „Odśwież wyniki”, żeby pobrać dane.");
    return;
  }

  $("#reportDataMeta").textContent = `${report.title}: ${state.reportRows.length.toLocaleString("pl-PL")} wierszy, filtr: ${describeTimeFilter()}.`;
  renderReportTable(
    state.reportHeaders,
    state.reportRows,
    "Brak dokumentów spełniających warunek raportu w wybranym okresie.",
  );
}

function renderReportTable(headers, rows, emptyMessage) {
  $("#reportDataHead").innerHTML = headers.length
    ? `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`
    : "";
  $("#reportDataRows").innerHTML = rows.length
    ? rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>`).join("")
    : `<tr><td class="empty" colspan="${Math.max(headers.length, 1)}">${escapeHtml(emptyMessage)}</td></tr>`;
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

function renderReportFilterChips(report) {
  $("#reportFilterChips").innerHTML = report.filters
    .map((filter) => `<span class="report-filter-chip">${escapeHtml(filter)}</span>`)
    .join("");
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
