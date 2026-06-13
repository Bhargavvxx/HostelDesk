import { BrowserRouter, Routes, Route } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/hooks/useTheme"
import { AppShell } from "@/components/layout/AppShell"
import Dashboard from "@/routes/Dashboard"
import Students from "@/routes/Students"
import Movement from "@/routes/Movement"
import Fees from "@/routes/Fees"
import More from "@/routes/More"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Local-first: no network fetching by default
      // TanStack Query will be used for local Dexie reads in later tickets
      staleTime: Infinity,
      retry: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/students" element={<Students />} />
              <Route path="/movement" element={<Movement />} />
              <Route path="/fees" element={<Fees />} />
              <Route path="/more" element={<More />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
