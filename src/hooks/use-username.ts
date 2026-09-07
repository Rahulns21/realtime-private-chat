import { STORAGE_KEY } from "@/lib/constants";
import { generateUsername } from "@/lib/utils";
import { useEffect, useState } from "react";

export const useUsername = () => {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const main = () => {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        setUsername(stored);
        return;
      }

      const generated = generateUsername();
      localStorage.setItem(STORAGE_KEY, generated);
      setUsername(generated);
    };

    main();
  }, []);

  return { username };
};
