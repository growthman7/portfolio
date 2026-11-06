/** Frappe de la commande de l'invite, rejouée à chaque visite (instantanée si mouvement réduit). */
import { reducedMotion, wait } from "../utils/motion.js";

export async function typeCommand(target, command, { speed = 85, startDelay = 350 } = {}) {
  if (reducedMotion()) {
    target.textContent = command;
    return;
  }
  await wait(startDelay);
  for (let i = 1; i <= command.length; i += 1) {
    target.textContent = command.slice(0, i);
    // Léger aléa pour un rythme de frappe naturel.
    await wait(speed + Math.round(Math.random() * 40) - 20);
  }
  await wait(220);
}
