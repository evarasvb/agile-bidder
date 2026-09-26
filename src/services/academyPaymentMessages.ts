export interface AcademyPaymentReturnNotice {
  tone: 'info' | 'error';
  message: string;
}

export function getAcademyPaymentReturnNotice(
  status: string | null,
): AcademyPaymentReturnNotice | null {
  if (status === 'ok' || status === 'pendiente') {
    return {
      tone: 'info',
      message:
        'Regresaste de Mercado Pago. Estamos verificando el resultado; enviaremos el acceso por correo solo cuando Mercado Pago lo confirme.',
    };
  }
  if (status === 'error') {
    return {
      tone: 'error',
      message:
        'Mercado Pago no confirmó el pago en este regreso. Si hubo un cobro, espera el correo de confirmación o contáctanos.',
    };
  }
  return null;
}
