import styles from "./product-visual.module.css";

const scenes = {
  clara: "0% 0%",
  marina: "100% 0%",
  rafael: "0% 100%",
  bia: "100% 100%",
};

export function ProductVisual({ contact }) {
  const position = scenes[contact?.scene || contact?.id];
  return (
    <span aria-hidden="true" className={styles.frame}>
      {position ? (
        <span
          className={styles.photo}
          style={{ backgroundPosition: position }}
        />
      ) : (
        <span className={styles.monogram}>{contact?.initials || "SA"}</span>
      )}
    </span>
  );
}
