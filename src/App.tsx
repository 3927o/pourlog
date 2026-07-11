import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  BeanDetail,
  BeanForm,
  BeansPage,
  BrewPage,
  JournalDetail,
  JournalPage,
  RecipeForm,
  RecipesPage,
} from "./pages";
import { SettingsPage } from "./settings/SettingsPage";
import { Loading, Page } from "./ui";

const SimulatorPage = lazy(() =>
  import("./simulator/SimulatorPage").then((module) => ({
    default: module.SimulatorPage,
  })),
);

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/beans" replace />} />
      <Route path="/beans" element={<BeansPage />} />
      <Route path="/beans/new" element={<BeanForm />} />
      <Route path="/beans/:id" element={<BeanDetail />} />
      <Route path="/beans/:id/edit" element={<BeanForm />} />
      <Route path="/brew/:beanId" element={<BrewPage />} />
      <Route path="/journal" element={<JournalPage />} />
      <Route path="/journal/:id" element={<JournalDetail />} />
      <Route path="/recipes" element={<RecipesPage />} />
      <Route path="/recipes/new" element={<RecipeForm />} />
      <Route path="/recipes/:id/edit" element={<RecipeForm />} />
      <Route
        path="/simulator"
        element={
          <Page>
            <Suspense fallback={<Loading />}>
              <SimulatorPage />
            </Suspense>
          </Page>
        }
      />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/beans" replace />} />
    </Routes>
  );
}
