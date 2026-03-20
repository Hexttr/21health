export function translateAiProviderErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return 'Произошла ошибка AI-сервиса. Попробуйте еще раз.';
  }

  const lower = trimmed.toLowerCase();

  if (
    lower.includes('credit balance is too low') ||
    lower.includes('purchase credits') ||
    lower.includes('plans & billing')
  ) {
    if (lower.includes('anthropic')) {
      return 'На API-ключе Anthropic закончился баланс. Пополните баланс в кабинете Anthropic и повторите попытку.';
    }
    return 'На API-ключе провайдера закончился баланс. Пополните баланс у провайдера и повторите попытку.';
  }

  if (
    lower.includes('insufficient_quota') ||
    lower.includes('exceeded your current quota') ||
    lower.includes('quota exceeded')
  ) {
    return 'На API-ключе провайдера закончился баланс или исчерпана квота. Пополните баланс у провайдера и повторите попытку.';
  }

  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    return 'Превышен лимит запросов к AI-провайдеру. Попробуйте немного позже.';
  }

  if (
    lower.includes('invalid api key') ||
    lower.includes('invalid x-api-key') ||
    lower.includes('authentication_error') ||
    lower.includes('unauthorized') ||
    lower.includes('api key not valid')
  ) {
    return 'AI-провайдер отклонил API-ключ. Проверьте ключ в настройках.';
  }

  if (
    lower.includes('model_not_found') ||
    lower.includes('does not exist') ||
    lower.includes('not found') ||
    lower.includes('unsupported model') ||
    lower.includes('model is not supported') ||
    lower.includes('unsupported_value')
  ) {
    return 'Выбранная AI-модель сейчас недоступна у провайдера.';
  }

  if (
    lower.includes('overloaded') ||
    lower.includes('temporarily unavailable') ||
    lower.includes('service unavailable') ||
    lower.includes('try again later')
  ) {
    return 'AI-провайдер сейчас временно недоступен или перегружен. Попробуйте немного позже.';
  }

  if (
    lower.includes('context length') ||
    lower.includes('maximum context length') ||
    lower.includes('prompt is too long') ||
    lower.includes('too many tokens')
  ) {
    return 'Запрос получился слишком большим для выбранной модели. Сократите сообщение или вложения и попробуйте снова.';
  }

  if (
    lower.includes('unsupported parameter') ||
    lower.includes('invalid_request_error') ||
    lower.includes('bad request')
  ) {
    return 'AI-провайдер отклонил параметры запроса. Попробуйте еще раз или выберите другую модель.';
  }

  if (
    lower.includes('reasoning') ||
    lower.includes('thinking') ||
    lower.includes('not available') ||
    lower.includes('unavailable')
  ) {
    return 'Выбранная AI-модель сейчас недоступна у провайдера.';
  }

  if (!/[а-яё]/i.test(trimmed) && /[a-z]/i.test(trimmed)) {
    return 'AI-провайдер вернул ошибку. Попробуйте еще раз или выберите другую модель.';
  }

  return trimmed;
}
