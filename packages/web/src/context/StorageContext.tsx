import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  StorageAdapter,
  SprintService,
  GoalService,
  CriterionService,
  ExportService,
} from '@sprint-tracker/core';
import { DexieStorage } from '../db/dexie-storage';

interface Services {
  sprintService: SprintService;
  goalService: GoalService;
  criterionService: CriterionService;
  exportService: ExportService;
}

interface StorageContextValue {
  storage: StorageAdapter | null;
  services: Services | null;
  isReady: boolean;
  error: string | null;
}

const StorageContext = createContext<StorageContextValue>({
  storage: null,
  services: null,
  isReady: false,
  error: null,
});

interface StorageProviderProps {
  children: ReactNode;
}

export function StorageProvider({ children }: StorageProviderProps) {
  const [storage, setStorage] = useState<StorageAdapter | null>(null);
  const [services, setServices] = useState<Services | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initStorage() {
      try {
        const dexieStorage = new DexieStorage();
        await dexieStorage.initialize();

        const svc: Services = {
          sprintService: new SprintService(dexieStorage),
          goalService: new GoalService(dexieStorage),
          criterionService: new CriterionService(dexieStorage),
          exportService: new ExportService(dexieStorage),
        };

        setStorage(dexieStorage);
        setServices(svc);
        setIsReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize storage');
      }
    }

    initStorage();
  }, []);

  return (
    <StorageContext.Provider value={{ storage, services, isReady, error }}>
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage(): StorageContextValue {
  return useContext(StorageContext);
}

export function useServices(): Services {
  const { services, isReady, error } = useContext(StorageContext);
  if (error) {
    throw new Error(`Storage error: ${error}`);
  }
  if (!isReady || !services) {
    throw new Error('Storage not initialized. Make sure to use within StorageProvider.');
  }
  return services;
}
