// Déclaration globale pour le matcher toHaveNoViolations de jest-axe
import 'jest-axe';
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveNoViolations(): R;
    }
  }
}
