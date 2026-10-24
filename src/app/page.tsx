import { AppLoader } from "@/components/AppLoader";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Item Search</h1>
      <AppLoader />
    </main>
  );
}
