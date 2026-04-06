import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ElectrobunRootProvider } from "./lib/electrobunContext";
import { AppSettingsProvider } from "./settingsContext";
import { ThemeProvider } from "./themeContext";
import AppLayout from "./components/AppLayout";
import HomePage from "./pages/HomePage";
import ExportsPage from "./pages/ExportsPage";

export default function App() {
  return (
    <ElectrobunRootProvider>
      <ThemeProvider>
        <AppSettingsProvider>
          <HashRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/saved" element={<ExportsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </HashRouter>
        </AppSettingsProvider>
      </ThemeProvider>
    </ElectrobunRootProvider>
  );
}
