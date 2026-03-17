interface SmsRuSendItem {
  status?: 'OK' | 'ERROR';
  status_code?: number;
  status_text?: string;
  sms_id?: string;
}

interface SmsRuSendResponse {
  status?: 'OK' | 'ERROR';
  status_code?: number;
  status_text?: string;
  balance?: number;
  sms?: Record<string, SmsRuSendItem>;
}

const SMS_RU_SEND_URL = 'https://sms.ru/sms/send';

function getSmsRuApiId(): string {
  const apiId = process.env.SMS_RU_API_ID?.trim();
  if (!apiId) {
    throw new Error('SMS.ru не настроен на сервере');
  }
  return apiId;
}

function getSmsRuSender(): string | null {
  return process.env.SMS_RU_FROM?.trim() || null;
}

function isSmsRuTestMode(): boolean {
  const raw = process.env.SMS_RU_TEST_MODE?.trim().toLowerCase();
  if (!raw) {
    return true;
  }

  return raw === '1' || raw === 'true' || raw === 'yes';
}

function buildVerificationMessage(code: string): string {
  return `Код подтверждения 21day: ${code}. Никому не сообщайте его.`;
}

function formatSmsRuError(statusCode?: number, statusText?: string): string {
  const text = statusText?.trim();
  if (text) {
    return `SMS.ru: ${text}`;
  }

  if (statusCode === 201) {
    return 'SMS.ru: недостаточно средств на счете';
  }
  if (statusCode === 204 || statusCode === 221) {
    return 'SMS.ru: отправитель не настроен или не согласован';
  }
  if (statusCode === 220 || statusCode === 500) {
    return 'SMS.ru временно недоступен, попробуйте позже';
  }

  return `SMS.ru: ошибка отправки SMS${statusCode ? ` (${statusCode})` : ''}`;
}

export async function sendSmsRuCode(phone: string, code: string): Promise<void> {
  const body = new URLSearchParams({
    api_id: getSmsRuApiId(),
    to: phone,
    msg: buildVerificationMessage(code),
    json: '1',
  });

  const sender = getSmsRuSender();
  if (sender) {
    body.set('from', sender);
  }

  if (isSmsRuTestMode()) {
    body.set('test', '1');
  }

  let response: Response;
  try {
    response = await fetch(SMS_RU_SEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
  } catch {
    throw new Error('Не удалось связаться с SMS.ru');
  }

  let payload: SmsRuSendResponse | null = null;
  try {
    payload = await response.json() as SmsRuSendResponse;
  } catch {
    throw new Error('SMS.ru вернул некорректный ответ');
  }

  if (!response.ok) {
    throw new Error(formatSmsRuError(payload?.status_code, payload?.status_text));
  }

  if (payload.status !== 'OK' || payload.status_code !== 100) {
    throw new Error(formatSmsRuError(payload.status_code, payload.status_text));
  }

  const item = payload.sms?.[phone];
  if (!item || item.status !== 'OK' || item.status_code !== 100) {
    throw new Error(formatSmsRuError(item?.status_code, item?.status_text));
  }
}
