'use client';

/* Telegram profile photos are remote, user-provided URLs rendered directly. */
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { RecipeCard, RecipeEditor } from './components/recipe';
import { isDrink, type Recipe } from '@/lib/recipes';

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData: string; ready: () => void; expand: () => void; isVersionAtLeast?: (version: string) => boolean; disableVerticalSwipes?: () => void } };
  }
}

type User = { id: number; name: string; role: 'employee' | 'admin'; username?: string | null; photoUrl?: string | null };
type Dish = {
  id: number; name: string; short_description: string; ingredients: string[];
  allergens: string[]; service_note: string; badge: string; color: string;
  category: string; weight: number; recipe?: Recipe | null; components: Record<string, string[]>;
};
type Invite = { code: string; label: string; role: string; max_uses: number; used_count: number };
type StaffMember = {
  id: number; name: string; role: 'employee' | 'admin'; telegram_id?: string | null;
  username?: string | null; photo_url?: string | null; created_at: string;
  last_seen_at?: string | null; active: number; attempt_count: number; last_attempt_at?: string | null;
};
type AttemptResult = { id: number; staff_id: number; staff_name: string; score: number; total: number; created_at: string };
type AppData = { user: User | null; dishes: Dish[]; invites: Invite[]; staff: StaffMember[]; attempts: AttemptResult[]; staffCount: number; employeeAccessCode: string | null };
type Tab = 'menu' | 'test' | 'book' | 'admin';

const emptyData: AppData = { user: null, dishes: [], invites: [], staff: [], attempts: [], staffCount: 0, employeeAccessCode: null };

const menuSections = [
  { id: 'crudo', name: 'Крудо', caption: 'Raw bar', symbol: '◉', tone: 'sea' },
  { id: 'starters', name: 'Закуски', caption: 'Для начала', symbol: '✦', tone: 'olive' },
  { id: 'bruschetta', name: 'Брускетты', caption: 'На хлебе', symbol: '▱', tone: 'terracotta' },
  { id: 'salads', name: 'Салаты', caption: 'Свежие', symbol: '◇', tone: 'leaf' },
  { id: 'healthy', name: 'ЗОЖ', caption: 'Баланс', symbol: '◎', tone: 'mint' },
  { id: 'soups', name: 'Супы', caption: 'Тёплые', symbol: '∿', tone: 'amber' },
  { id: 'pasta', name: 'Паста и ризотто', caption: 'Итальянская классика', symbol: '≈', tone: 'wheat' },
  { id: 'pizza', name: 'Пицца', caption: 'Из печи', symbol: '○', tone: 'tomato' },
  { id: 'focaccia', name: 'Фокачча', caption: 'Из печи', symbol: '▤', tone: 'sand' },
  { id: 'meat', name: 'Мясо и птица', caption: 'Основные блюда', symbol: '◐', tone: 'wine' },
  { id: 'sides', name: 'Гарниры', caption: 'Дополнения', symbol: '+', tone: 'herb' },
  { id: 'fish', name: 'Рыба и морепродукты', caption: 'Из моря', symbol: '≋', tone: 'ocean' },
  { id: 'desserts', name: 'Десерты', caption: 'Dolce', symbol: '✧', tone: 'berry' },
  { id: 'lemonade', name: 'Лимонад', caption: '0,4 л и 1 л', symbol: '◒', tone: 'mint' },
  { id: 'milkshakes', name: 'Милкшейки', caption: 'Молочные коктейли', symbol: '◍', tone: 'berry' },
  { id: 'tea', name: 'Чай', caption: 'Авторские чаи', symbol: '♧', tone: 'amber' },
] as const;

function normalizeSearchValue(value: string) {
  return value.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').trim();
}

async function api<T = Record<string, unknown>>(body?: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/app', body ? {
    method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : undefined);
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error || 'Что-то пошло не так');
  return result as T;
}

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = { menu: '⌂', test: '✓', book: '◇', admin: '⚙', search: '⌕', back: '‹', close: '×', plus: '+', edit: '✎' };
  return <span aria-hidden="true" className="icon">{icons[name]}</span>;
}

function JoinScreen({ onJoin }: { onJoin: (user: User) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const result = await api<{ user: User }>({ action: 'join', code, initData: window.Telegram?.WebApp?.initData || '' });
      onJoin(result.user);
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось войти'); }
    finally { setBusy(false); }
  }

  return (
    <main className="app-shell join-shell">
      <section className="phone-frame join-frame">
        <div className="brand-mark">DP</div>
        <p className="eyebrow center">Due Passi · Команда</p>
        <h1 className="join-title">Добро пожаловать<br />в команду</h1>
        <p className="join-copy">Изучайте меню, проверяйте знания и сохраняйте стандарты гостеприимства в одном месте.</p>
        <form className="join-form" onSubmit={submit}>
          <label><span>Код доступа</span><input className="code-input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" inputMode="numeric" autoComplete="one-time-code" /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? 'Проверяем…' : 'Продолжить'}</button>
        </form>
        <div className="telegram-note"><span>✦</span><div><strong>Профиль из Telegram</strong><p>Имя и фотография сотрудника загрузятся автоматически.</p></div></div>
      </section>
    </main>
  );
}

function DishDetail({ dish, onClose, selectedForTest, canAddToTest, onToggleTest }: { dish: Dish; onClose: () => void; selectedForTest: boolean; canAddToTest: boolean; onToggleTest: () => void }) {
  const [componentName, setComponentName] = useState<string | null>(null);
  const sectionName = menuSections.find((section) => section.id === dish.category)?.name ?? 'Меню';
  const componentItems = componentName ? dish.components?.[componentName] ?? [] : [];
  const baseIngredients = dish.ingredients.filter((item) => !dish.components?.[item]?.length);
  const compoundIngredients = dish.ingredients.filter((item) => dish.components?.[item]?.length);
  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="detail-sheet" role="dialog" aria-modal="true" aria-label={dish.name}>
        <div className={`detail-hero ${dish.color}`}>
          <button className="glass-button" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button>
          <span className="detail-number">{sectionName} · {dish.recipe ? 'Техкарта' : dish.weight ? `${dish.weight} г` : String(dish.id).padStart(2, '0')}</span>
          <div><span className="light-tag">{dish.badge}</span><h2>{dish.name}</h2><p>{dish.short_description}</p></div>
        </div>
        <div className="detail-body">
          {dish.recipe ? <RecipeCard key={dish.id} recipe={dish.recipe} /> : <><p className="eyebrow">Основа и дополнения</p>
          <div className="ingredient-cloud">{baseIngredients.map((item) => <span key={item}>{item}</span>)}</div>
          {compoundIngredients.length > 0 && <><p className="eyebrow ingredient-subtitle">Соусы и составные компоненты</p><div className="ingredient-cloud compound-cloud">{compoundIngredients.map((item) => <button className="nested-ingredient" key={item} onClick={() => setComponentName(item)}>{item}<small>нажмите, чтобы открыть состав</small><b>›</b></button>)}</div></>}
          </>}{dish.service_note && <div className="info-block"><span className="info-symbol">!</span><div><strong>{dish.recipe ? 'Приготовление и подача' : 'Важно для гостя'}</strong><p>{dish.service_note}</p></div></div>}
          {(!dish.recipe || dish.allergens.length > 0) && <div className="allergen-row"><span>Аллергены</span><strong>{dish.allergens.join(', ') || 'не указаны'}</strong></div>}
          {dish.weight > 0 && <div className="weight-row"><span>Выход блюда</span><strong>{dish.weight} г</strong></div>}
          {!isDrink(dish.category) && <button className={`test-picker-button ${selectedForTest ? 'selected' : ''}`} disabled={!selectedForTest && !canAddToTest} onClick={onToggleTest}><span>{selectedForTest ? '✓' : '+'}</span><div><strong>{selectedForTest ? 'Добавлено в тест' : 'Добавить в тест'}</strong><small>{selectedForTest ? 'Нажмите, чтобы убрать позицию' : canAddToTest ? 'Позиция гарантированно попадёт в следующий тест' : 'Можно выбрать не более 15 позиций'}</small></div></button>}
        </div>
        {componentName && <div className="component-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setComponentName(null)}><section className="component-card"><button onClick={() => setComponentName(null)} aria-label="Закрыть">×</button><p className="eyebrow">Внутренний состав</p><h3>{componentName}</h3><div>{componentItems.map((item, index) => <span key={item}><i>{String(index + 1).padStart(2, '0')}</i>{item}</span>)}</div><small>Нажмите вне окна, чтобы закрыть</small></section></div>}
      </section>
    </div>
  );
}

function MenuView({ dishes, onSelect }: { dishes: Dish[]; onSelect: (dish: Dish) => void }) {
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [rootQuery, setRootQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const rootSearchRef = useRef<HTMLDivElement>(null);
  const sectionSearchRef = useRef<HTMLDivElement>(null);
  const currentSection = menuSections.find((section) => section.id === sectionId);
  const sectionDishes = currentSection ? dishes.filter((dish) => dish.category === currentSection.id) : [];
  const normalizedQuery = normalizeSearchValue(query);
  const filtered = sectionDishes.filter((dish) => normalizeSearchValue(`${dish.name} ${dish.ingredients.join(' ')}`).includes(normalizedQuery));
  const renderDishList = (items: Dish[]) => <div className="dish-list">{items.map((dish, index) => <button className="dish-card" key={dish.id} onClick={() => onSelect(dish)}><div className={`dish-visual ${dish.color}`}><span>{String(index + 1).padStart(2, '0')}</span><i /></div><div className="dish-copy"><div className="dish-meta"><span className="tag">{dish.badge}</span>{dish.recipe && <span className="weight-chip">{dish.recipe.variants.length > 1 ? dish.recipe.variants.map((v) => v.label).join(' / ') : 'Техкарта'}</span>}{dish.weight > 0 && <span className="weight-chip">{dish.weight} г</span>}</div><h3>{dish.name}</h3><p>{dish.ingredients.slice(0, 4).join(', ')}</p></div><span className="chevron">›</span></button>)}</div>;
  const normalizedRootQuery = normalizeSearchValue(rootQuery);
  const rootResults = normalizedRootQuery ? dishes
    .filter((dish) => normalizeSearchValue(`${dish.name} ${dish.ingredients.join(' ')}`).includes(normalizedRootQuery))
    .sort((first, second) => Number(!normalizeSearchValue(first.name).startsWith(normalizedRootQuery)) - Number(!normalizeSearchValue(second.name).startsWith(normalizedRootQuery)) || first.name.localeCompare(second.name, 'ru')) : [];
  function liftSearch(ref: { current: HTMLDivElement | null }) {
    const scroll = () => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    requestAnimationFrame(scroll);
    window.setTimeout(scroll, 320);
  }
  const tomatoPizza = currentSection?.id === 'pizza' ? filtered.filter((dish) => dish.ingredients.includes('соус пицца')) : [];
  const creamyPizza = currentSection?.id === 'pizza' ? filtered.filter((dish) => dish.ingredients.some((item) => item === 'сливки' || item.startsWith('сливки '))) : [];
  const otherPizza = currentSection?.id === 'pizza' ? filtered.filter((dish) => !tomatoPizza.includes(dish) && !creamyPizza.includes(dish)) : [];

  if (!currentSection) return <>
    <section className="intro-card menu-intro">
      <p className="intro-kicker">Меню ресторана</p><h2>Изучайте каждое<br />блюдо уверенно.</h2>
      <div className="intro-meta"><span>{menuSections.length} разделов</span><span>{dishes.length} позиций</span></div>
    </section>
    <div className="search-box root-search-box" ref={rootSearchRef}><Icon name="search" /><input value={rootQuery} onFocus={() => liftSearch(rootSearchRef)} onChange={(event) => setRootQuery(event.target.value)} placeholder="Блюдо, напиток или ингредиент" enterKeyHint="search" />{rootQuery && <button onClick={() => setRootQuery('')} aria-label="Очистить поиск">×</button>}</div>
    {normalizedRootQuery ? <>
      <div className="catalog-heading search-results-heading"><div><p className="eyebrow">Быстрый поиск</p><h2>Найденные позиции</h2></div><span>{rootResults.length}</span></div>
      {rootResults.length ? renderDishList(rootResults) : <div className="empty-state"><span>⌕</span><strong>Ничего не найдено</strong><p>Попробуйте написать часть названия</p></div>}
    </> : <><div className="catalog-heading"><div><p className="eyebrow">Все категории</p><h2>Разделы меню</h2></div><span>{menuSections.length}</span></div>
    <div className="category-grid">
      {menuSections.map((section, index) => <button className={`category-card tone-${section.tone}`} key={section.id} onClick={() => { setSectionId(section.id); setSearchOpen(false); setQuery(''); }}>
        <span className="category-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="category-symbol">{section.symbol}</span>
        <div><strong>{section.name}</strong><small>{dishes.filter((dish) => dish.category === section.id).length ? `${dishes.filter((dish) => dish.category === section.id).length} позиций` : section.caption}</small></div>
        <i>›</i>
      </button>)}
    </div></>}
  </>;

  const sectionNumber = menuSections.findIndex((section) => section.id === currentSection.id) + 1;
  const hasDishes = sectionDishes.length > 0;
  return <section className="category-view">
    <button className="back-link category-back" onClick={() => setSectionId(null)}><Icon name="back" /> Все разделы</button>
    <div className={`category-banner tone-${currentSection.tone}`}>
      <span className="category-symbol">{currentSection.symbol}</span>
      <div><p>Раздел {String(sectionNumber).padStart(2, '0')}</p><h2>{currentSection.name}</h2><small>{hasDishes ? `${sectionDishes.length} позиций в разделе` : currentSection.caption}</small></div>
    </div>
    {hasDishes ? <>
      <div className="section-heading compact-heading"><div><p className="eyebrow">{isDrink(currentSection.id) ? 'Напитки' : 'Блюда'}</p><h2>{isDrink(currentSection.id) ? 'Техкарты напитков' : 'Состав и подача'}</h2></div><button className="round-action" aria-label="Поиск" onClick={() => setSearchOpen(!searchOpen)}><Icon name="search" /></button></div>
      {searchOpen && <div className="search-box section-search-box" ref={sectionSearchRef}><Icon name="search" /><input autoFocus value={query} onFocus={() => liftSearch(sectionSearchRef)} onChange={(e) => setQuery(e.target.value)} placeholder="Блюдо или ингредиент" enterKeyHint="search" /><button onClick={() => { setQuery(''); setSearchOpen(false); }}>×</button></div>}
      {currentSection.id === 'pizza' ? <div className="pizza-groups">
        {tomatoPizza.length > 0 && <section className="dish-subsection"><div className="dish-group-heading"><span className="base-dot tomato-dot" /><div><strong>Томатная основа</strong><small>{tomatoPizza.length} позиций</small></div></div>{renderDishList(tomatoPizza)}</section>}
        {creamyPizza.length > 0 && <section className="dish-subsection"><div className="dish-group-heading"><span className="base-dot cream-dot" /><div><strong>Сливочная основа</strong><small>{creamyPizza.length} позиций</small></div></div>{renderDishList(creamyPizza)}</section>}
        {otherPizza.length > 0 && <section className="dish-subsection"><div className="dish-group-heading"><span className="base-dot other-dot" /><div><strong>Другая основа</strong><small>{otherPizza.length} позиций</small></div></div>{renderDishList(otherPizza)}</section>}
        {!filtered.length && <div className="empty-state"><span>⌕</span><strong>Ничего не найдено</strong><p>Попробуйте изменить запрос</p></div>}
      </div> : <>{renderDishList(filtered)}{!filtered.length && <div className="empty-state"><span>⌕</span><strong>Ничего не найдено</strong><p>Попробуйте изменить запрос</p></div>}</>}
    </> : <div className="section-placeholder"><span className={`placeholder-symbol tone-${currentSection.tone}`}>{currentSection.symbol}</span><strong>Раздел готов</strong><p>Блюда категории «{currentSection.name}» добавим на следующем этапе.</p><button onClick={() => setSectionId(null)}>Вернуться к меню</button></div>}
  </section>;
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[otherIndex]] = [result[otherIndex], result[index]];
  }
  return result;
}

function testDishName(dish: Dish) {
  const name = dish.name.trim();
  if (dish.category === 'pizza' && !/^пицца\b/i.test(name)) return `Пицца «${name}»`;
  if (dish.category === 'focaccia' && !/^фокачча\b/i.test(name)) return `Фокачча «${name}»`;
  if (dish.category === 'pasta' && dish.ingredients.includes('ризотто база') && !/^ризотто\b/i.test(name)) return `Ризотто «${name}»`;
  return name;
}

function TestView({ dishes, user, selectedDishIds, onClearSelection }: { dishes: Dish[]; user: User; selectedDishIds: number[]; onClearSelection: () => void }) {
  const [started, setStarted] = useState(false); const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string[]>([]); const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false); const [finished, setFinished] = useState(false); const [finalScore, setFinalScore] = useState(0);
  const [questions, setQuestions] = useState<Dish[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const saving = useRef(false);
  const attemptId = useRef('');
  const [requestedQuestionIds, setRequestedQuestionIds] = useState<number[]>([]);
  const requestedDishes = selectedDishIds.map((id) => dishes.find((dish) => dish.id === id)).filter((dish): dish is Dish => Boolean(dish)).slice(0, 15);
  const options = useMemo(() => {
    const correct = questions[current]?.ingredients ?? [];
    const extras = [...new Set(dishes.flatMap((dish) => dish.ingredients).filter((item) => !correct.includes(item)))];
    return shuffle([...correct, ...shuffle(extras).slice(0, 4)]);
  }, [current, dishes, questions]);
  const isCorrect = questions[current] && selected.length === questions[current].ingredients.length && selected.every((item) => questions[current].ingredients.includes(item));

  function restart() {
    attemptId.current = crypto.randomUUID();
    setSaveStatus('idle'); setSaveError('');
    const requested = requestedDishes;
    const requestedIds = new Set(requested.map((dish) => dish.id));
    const randomDishes = shuffle(dishes.filter((dish) => !requestedIds.has(dish.id))).slice(0, Math.max(0, 15 - requested.length));
    // User-selected dishes go first (in a random order), then random fillers.
    // This makes the guarantee visible and prevents a selected item from being
    // mistaken for a missing one while preserving randomness inside both groups.
    setQuestions([...shuffle(requested), ...randomDishes]);
    setRequestedQuestionIds([...requestedIds]);
    setStarted(true); setCurrent(0); setSelected([]); setScore(0); setFinalScore(0); setAnswered(false); setFinished(false);
  }
  async function saveResult(result: number) {
    if (saving.current) return;
    saving.current = true;
    setSaveStatus('saving'); setSaveError('');
    try {
      await api({ action: 'attempt', staffId: user.id, score: result, total: questions.length, requestId: attemptId.current });
      setSaveStatus('saved');
    } catch (error) {
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : 'Проверьте подключение к интернету');
    } finally { saving.current = false; }
  }

  async function next() {
    if (!answered) { setAnswered(true); return; }
    const nextScore = score + (isCorrect ? 1 : 0);
    setScore(nextScore);
    if (current === questions.length - 1) { setFinalScore(nextScore); setFinished(true); await saveResult(nextScore); }
    else { setCurrent((value) => value + 1); setSelected([]); setAnswered(false); }
  }

  if (!started) return <section className="feature-view"><div className="feature-icon">✓</div><p className="eyebrow center">Проверка знаний</p><h2>Готовы проверить<br />себя?</h2><p>Тест состоит из 15 блюд. Выбранные позиции будут первыми вопросами в случайном порядке, остальные добавятся случайно.</p>{requestedDishes.length > 0 && <div className="selected-test-note"><strong>Выбрано вами: {requestedDishes.length}</strong><span>Ещё {Math.max(0, 15 - requestedDishes.length)} добавится случайно</span><div className="selected-test-list">{requestedDishes.map((dish) => <i key={dish.id}>{testDishName(dish)}</i>)}</div><button onClick={onClearSelection}>Очистить выбор</button></div>}<div className="test-stats"><div><strong>{Math.min(15, dishes.length)}</strong><span>вопросов</span></div><div><strong>80%</strong><span>проходной балл</span></div></div><button className="primary-button" disabled={!dishes.length} onClick={restart}>Начать тест</button></section>;
  if (finished) return <section className="feature-view result-view"><div className="score-ring"><strong>{Math.round(finalScore / questions.length * 100)}%</strong><span>{finalScore} из {questions.length}</span></div><p className="eyebrow center">Тест завершён</p><h2>{finalScore / questions.length >= .8 ? 'Отличный результат!' : 'Стоит повторить меню'}</h2><div aria-live="polite">{saveStatus === 'saved' ? <p>Результат сохранён в приложении и доступен администратору.</p> : saveStatus === 'error' ? <><p role="alert">Не удалось сохранить результат. {saveError}</p><p>Оставайтесь на этом экране и повторите сохранение.</p><button className="primary-button" onClick={() => void saveResult(finalScore)}>Повторить сохранение</button></> : <p>Сохраняем результат…</p>}</div>{saveStatus === 'saved' && <button className="primary-button" onClick={restart}>Пройти ещё раз</button>}</section>;
  const dish = questions[current];
  const sectionName = menuSections.find((section) => section.id === dish.category)?.name ?? 'Меню';
  const requestedQuestion = requestedQuestionIds.includes(dish.id);
  return <section className="quiz-view"><div className="quiz-top"><span>Вопрос {current + 1} из {questions.length}</span><strong>{Math.round((current + 1) / questions.length * 100)}%</strong></div><div className="progress"><i style={{ width: `${(current + 1) / questions.length * 100}%` }} /></div><p className={`eyebrow question-kind ${requestedQuestion ? 'requested' : ''}`}>{requestedQuestion ? 'Выбрано вами' : 'Случайная позиция'} · {sectionName}</p><h2>{testDishName(dish)}</h2><div className="options">{options.map((option) => { const checked = selected.includes(option); const right = dish.ingredients.includes(option); return <button disabled={answered} key={option} className={`${checked ? 'selected' : ''} ${answered && checked ? (right ? 'right' : 'wrong') : ''}`} onClick={() => setSelected(checked ? selected.filter((item) => item !== option) : [...selected, option])}><span>{checked ? '✓' : ''}</span>{option}</button>; })}</div>{answered && <div className={`answer-note ${isCorrect ? 'success' : 'error'}`}><strong>{isCorrect ? 'Верно!' : 'Есть неточности'}</strong><p>{isCorrect ? 'Вы отлично знаете это блюдо.' : `Правильный состав: ${dish.ingredients.join(', ')}.`}</p></div>}<button className="primary-button sticky-action" disabled={!selected.length} onClick={next}>{answered ? (current === questions.length - 1 ? 'Узнать результат' : 'Следующий вопрос') : 'Проверить'}</button></section>;
}

function BookView() {
  const bookUrl = '/books/due-passi-hospitality-book.pdf';
  const readerRef = useRef<HTMLElement>(null);
  const [book, setBook] = useState<{ title: string; edition: string; pages: string[] } | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/books/hospitality-book-pages.json')
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить книгу');
        return response.json() as Promise<{ title: string; edition: string; pages: string[] }>;
      })
      .then((result) => setBook(result))
      .catch(() => setError('Не удалось загрузить текст. PDF по-прежнему доступен по кнопкам выше.'));
  }, []);

  function changePage(nextPage: number) {
    if (!book) return;
    setPage(Math.max(0, Math.min(nextPage, book.pages.length - 1)));
    requestAnimationFrame(() => readerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  return <section className="book-reader-view">
    <div className="book-reader-heading"><div><p className="eyebrow">Due Passi · Обучение</p><h2>Книга гостеприимства</h2><span>Сводная редакция · без содержания</span></div><a href={bookUrl} target="_blank" rel="noreferrer" aria-label="Открыть книгу отдельно">↗</a></div>
    <div className="book-reader-actions"><a className="secondary-button" href={bookUrl} download>Скачать PDF</a><a className="secondary-button" href={bookUrl} target="_blank" rel="noreferrer">Открыть отдельно</a></div>
    <section className="native-book-reader" ref={readerRef} aria-live="polite">
      {!book && !error && <div className="book-loading"><span className="pulse">DP</span><p>Загружаем текст книги…</p></div>}
      {error && <div className="book-error"><strong>Текст временно недоступен</strong><p>{error}</p></div>}
      {book && <>
        <div className="book-pagination top-pagination">
          <button onClick={() => changePage(page - 1)} disabled={page === 0} aria-label="Предыдущая страница">‹</button>
          <label><span>Страница</span><select value={page} onChange={(event) => changePage(Number(event.target.value))}>{book.pages.map((_, index) => <option value={index} key={index}>{index + 1} из {book.pages.length}</option>)}</select></label>
          <button onClick={() => changePage(page + 1)} disabled={page === book.pages.length - 1} aria-label="Следующая страница">›</button>
        </div>
        <article className="book-page"><div className="book-page-number">{String(page + 1).padStart(2, '0')}</div><pre>{book.pages[page]}</pre></article>
        <div className="book-progress" aria-hidden="true"><i style={{ width: `${(page + 1) / book.pages.length * 100}%` }} /></div>
        <div className="book-pagination bottom-pagination"><button onClick={() => changePage(page - 1)} disabled={page === 0}>‹ Назад</button><span>{page + 1} / {book.pages.length}</span><button onClick={() => changePage(page + 1)} disabled={page === book.pages.length - 1}>Далее ›</button></div>
      </>}
    </section>
  </section>;
}

function AdminView({ data, refresh }: { data: AppData; refresh: () => Promise<void> }) {
  const [mode, setMode] = useState<'home' | 'dish' | 'staff' | 'access' | 'results'>('home');
  const [editing, setEditing] = useState<Dish | null>(null); const [message, setMessage] = useState('');
  const [refreshingResults, setRefreshingResults] = useState(false);
  const [adminCategory, setAdminCategory] = useState('crudo');
  const [editorCategory, setEditorCategory] = useState('crudo');
  function openDish(dish: Dish | null) { setEditing(dish); setEditorCategory(dish?.category || adminCategory); setMode('dish'); }
  const categoryDishes = data.dishes.filter((dish) => dish.category === adminCategory);
  const categoryName = menuSections.find((section) => section.id === adminCategory)?.name ?? 'Меню';
  const resultGroups = data.staff.map((staff) => ({ staff, attempts: data.attempts.filter((attempt) => attempt.staff_id === staff.id) })).filter((group) => group.attempts.length > 0);

  async function saveDish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const category = String(form.get('category') || adminCategory);
    const components = Object.fromEntries(String(form.get('components') || '').split('\n').map((line) => { const separator = line.indexOf(':'); if (separator < 0) return null; const component = line.slice(0, separator).trim().toLowerCase(); const items = line.slice(separator + 1).split(',').map((item) => item.trim()).filter(Boolean); return component && items.length ? [component, items] : null; }).filter((entry): entry is [string, string[]] => Boolean(entry)));
    try { await api({ action: 'saveDish', id: editing?.id, name: form.get('name'), short_description: form.get('description'), ingredients: String(form.get('ingredients') || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean), allergens: String(form.get('allergens') || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean), service_note: form.get('note'), badge: form.get('badge'), category, weight: Number(form.get('weight') || 0), components, recipe: form.has('recipe') ? JSON.parse(String(form.get('recipe'))) : undefined, color: editing?.color || (category === 'bruschetta' ? 'terracotta' : 'sage') }); setMessage('Блюдо сохранено'); setAdminCategory(category); setMode('home'); setEditing(null); await refresh(); } catch (err) { setMessage(err instanceof Error ? err.message : 'Ошибка'); }
  }

  async function updateEmployeeCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api({ action: 'updateEmployeeCode', code: form.get('code') });
      setMessage('Код сотрудников изменён');
      await refresh();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Ошибка'); }
  }

  async function setStaffActive(staff: StaffMember, active: boolean) {
    if (!active && !window.confirm(`Исключить сотрудника «${staff.name}»? Он сразу потеряет доступ к приложению.`)) return;
    try {
      await api({ action: 'setStaffActive', staffId: staff.id, active });
      setMessage(active ? 'Доступ сотрудника восстановлен' : 'Сотрудник исключён');
      await refresh();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Ошибка'); }
  }

  async function refreshResults() {
    setRefreshingResults(true); setMessage('');
    try { await refresh(); setMessage('Результаты обновлены'); }
    catch { setMessage('Не удалось обновить результаты'); }
    finally { setRefreshingResults(false); }
  }

  const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : 'не входил';

  if (mode === 'dish') return <section className="admin-view"><button className="back-link" onClick={() => { setMode('home'); setEditing(null); }}><Icon name="back" /> Назад</button><p className="eyebrow">Редактор меню</p><h2>{editing ? 'Изменить блюдо' : 'Новое блюдо'}</h2><form className="admin-form" onSubmit={saveDish}><label><span>Раздел меню</span><select name="category" value={editorCategory} onChange={(event) => setEditorCategory(event.target.value)}>{menuSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label><label><span>Название</span><input name="name" defaultValue={editing?.name} required /></label><div className="admin-form-row"><label><span>Вес, г</span><input name="weight" type="number" min="0" defaultValue={editing?.weight || ''} placeholder="220" /></label><label><span>Метка</span><input name="badge" defaultValue={editing?.badge} placeholder="Хит" /></label></div><label><span>Короткое описание</span><textarea name="description" defaultValue={editing?.short_description} /></label>{(isDrink(editorCategory) || editing?.recipe) ? <RecipeEditor key={editing?.id ?? editorCategory} initial={editing?.recipe} category={editorCategory} /> : <><label><span>Основной состав через запятую</span><textarea name="ingredients" defaultValue={editing?.ingredients.join(', ')} required /></label><label><span>Вложенные составы</span><textarea className="components-input" name="components" defaultValue={Object.entries(editing?.components || {}).map(([name, items]) => `${name}: ${items.join(', ')}`).join('\n')} placeholder={'крем дайкон: сыр креметте, соус шрирача\nгуакамоле: авокадо, халапеньо'} /><small className="field-help">Каждый соус — с новой строки в формате «название: ингредиенты».</small></label></>}<label><span>Аллергены через запятую</span><input name="allergens" defaultValue={editing?.allergens.join(', ')} /></label><label><span>Подсказка официанту</span><textarea name="note" defaultValue={editing?.service_note} /></label><button className="primary-button">Сохранить блюдо</button></form></section>;
  if (mode === 'staff') return <section className="admin-view"><button className="back-link" onClick={() => { setMode('home'); setMessage(''); }}><Icon name="back" /> Панель администратора</button><p className="eyebrow">Управление доступом</p><h2>Сотрудники</h2><p className="admin-description">Здесь отображаются все Telegram-профили, которые хотя бы один раз авторизовались в приложении.</p><div className="staff-list">{data.staff.map((staff) => <article className={`staff-card ${staff.active ? '' : 'inactive'}`} key={staff.id}><div className="staff-avatar">{staff.photo_url ? <img src={staff.photo_url} alt="" /> : staff.name.charAt(0).toUpperCase()}</div><div className="staff-info"><div><strong>{staff.name}</strong><span className={`staff-status ${staff.active ? 'active' : ''}`}>{staff.active ? 'Активен' : 'Исключён'}</span></div><small>{staff.role === 'admin' ? 'Администратор' : 'Сотрудник'}{staff.username ? ` · @${staff.username}` : ''}</small><p>Последний вход: {formatDate(staff.last_seen_at)}{staff.attempt_count ? ` · Тестов: ${staff.attempt_count}` : ''}</p></div>{staff.role !== 'admin' && <button className={`staff-toggle ${staff.active ? 'remove' : 'restore'}`} onClick={() => setStaffActive(staff, !staff.active)}>{staff.active ? 'Исключить' : 'Вернуть'}</button>}</article>)}</div>{!data.staff.length && <div className="admin-empty"><span>○</span><p>Пока никто не авторизовывался</p></div>}{message && <p className="form-message">{message}</p>}</section>;
  if (mode === 'results') return <section className="admin-view"><button className="back-link" onClick={() => { setMode('home'); setMessage(''); }}><Icon name="back" /> Панель администратора</button><p className="eyebrow">Проверка знаний</p><div className="results-title-row"><h2>Результаты тестов</h2><button onClick={refreshResults} disabled={refreshingResults} aria-label="Обновить результаты"><span className={refreshingResults ? 'spinning' : ''}>↻</span>{refreshingResults ? 'Обновляем…' : 'Обновить'}</button></div><p className="admin-description">Последние результаты сгруппированы по сотрудникам. История хранится на сервере.</p>{message && <p className={`results-refresh-message ${message.includes('Не удалось') ? 'error' : ''}`}>{message}</p>}<div className="result-groups">{resultGroups.map(({ staff, attempts }) => { const best = Math.max(...attempts.map((attempt) => Math.round(attempt.score / attempt.total * 100))); return <article className="result-group" key={staff.id}><header><div className="staff-avatar">{staff.photo_url ? <img src={staff.photo_url} alt="" /> : staff.name.charAt(0).toUpperCase()}</div><div><strong>{staff.name}</strong><small>{attempts.length} {attempts.length === 1 ? 'тест' : attempts.length < 5 ? 'теста' : 'тестов'} · лучший {best}%</small></div></header><div className="attempt-list">{attempts.map((attempt) => { const percent = Math.round(attempt.score / attempt.total * 100); return <div key={attempt.id}><span><strong>{attempt.score} из {attempt.total}</strong><small>{formatDate(attempt.created_at)}</small></span><b className={percent >= 80 ? 'passed' : ''}>{percent}%</b></div>; })}</div></article>; })}</div>{!resultGroups.length && <div className="admin-empty"><span>✓</span><p>Сотрудники пока не проходили тесты</p></div>}</section>;
  if (mode === 'access') return <section className="admin-view"><button className="back-link" onClick={() => { setMode('home'); setMessage(''); }}><Icon name="back" /> Панель администратора</button><p className="eyebrow">Безопасность</p><h2>Код сотрудников</h2><p className="admin-description">Новый код потребуется при следующем входе. Уже открытые сессии сотрудников продолжат работать.</p><form className="admin-form access-code-form" onSubmit={updateEmployeeCode}><label><span>Новый код из 4 цифр</span><input className="code-input" name="code" defaultValue={data.employeeAccessCode || ''} inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} required /></label><button className="primary-button">Сохранить новый код</button></form>{message && <p className="form-message">{message}</p>}</section>;
  return <section className="admin-view"><p className="eyebrow">Управление</p><h2>Панель администратора</h2><div className="admin-summary"><div><strong>{data.dishes.length}</strong><span>блюд</span></div><button onClick={() => setMode('staff')}><strong>{data.staffCount}</strong><span>сотрудников</span><small>Открыть ›</small></button><div><strong>{menuSections.filter((section) => data.dishes.some((dish) => dish.category === section.id)).length}</strong><span>разделов заполнено</span></div></div><div className="admin-actions"><button className="admin-action" onClick={() => setMode('staff')}><span className="action-icon">◎</span><div><strong>Сотрудники</strong><small>Просмотр и управление доступом</small></div><b>›</b></button><button className="admin-action" onClick={() => setMode('access')}><span className="action-icon">#</span><div><strong>Код сотрудников</strong><small>Текущий код: {data.employeeAccessCode || '—'}</small></div><b>›</b></button><button className="admin-action" onClick={() => { setMode('results'); void refreshResults(); }}><span className="action-icon">✓</span><div><strong>Результаты тестов</strong><small>{data.attempts.length ? `${data.attempts.length} сохранённых результатов` : 'История пока пуста'}</small></div><b>›</b></button></div><div className="admin-category-scroll">{menuSections.map((section) => <button className={adminCategory === section.id ? 'active' : ''} key={section.id} onClick={() => setAdminCategory(section.id)}>{section.name}<small>{data.dishes.filter((dish) => dish.category === section.id).length}</small></button>)}</div><div className="admin-list-head"><strong>Меню · {categoryName}</strong><button onClick={() => { openDish(null); }}>+ Добавить</button></div><div className="admin-dishes">{categoryDishes.map((dish) => <button key={dish.id} onClick={() => { openDish(dish); }}><span className={`mini-color ${dish.color}`} /><div><strong>{dish.name}</strong><small>{dish.weight ? `${dish.weight} г · ` : ''}{dish.ingredients.length} ингредиентов</small></div><Icon name="edit" /></button>)}{!categoryDishes.length && <div className="admin-empty"><span>＋</span><p>В этом разделе пока нет блюд</p><button onClick={() => { openDish(null); }}>Добавить первое</button></div>}</div>{message && <p className="form-message">{message}</p>}</section>;
}

export default function Home() {
  const [user, setUser] = useState<User | null | undefined>(undefined); const [data, setData] = useState<AppData>(emptyData);
  const [tab, setTab] = useState<Tab>('menu'); const [selectedDish, setSelectedDish] = useState<Dish | null>(null); const [profileOpen, setProfileOpen] = useState(false);
  const [testDishIds, setTestDishIds] = useState<number[]>([]);
  function toggleTestDish(dishId: number) { setTestDishIds((ids) => ids.includes(dishId) ? ids.filter((id) => id !== dishId) : ids.length < 15 ? [...ids, dishId] : ids); }
  async function refresh() { const result = await api<AppData>(); setData(result); setUser(result.user); }
  async function logout() { await api({ action: 'logout' }); setData(emptyData); setUser(null); setProfileOpen(false); setTab('menu'); }
  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready();
    webApp?.expand();
    if (webApp?.isVersionAtLeast?.('7.7')) webApp.disableVerticalSwipes?.();
    let cancelled = false;
    api<AppData>().then((result) => {
      if (!cancelled) { setData(result); setUser(result.user); }
    }).catch(() => {
      if (!cancelled) { setData(emptyData); setUser(null); }
    });
    return () => { cancelled = true; };
  }, []);
  if (user === undefined) return <main className="app-shell"><section className="phone-frame loading-frame"><div className="brand-mark pulse">DP</div></section></main>;
  if (!user) return <JoinScreen onJoin={(joined) => { setUser(joined); refresh(); }} />;
  const firstName = user.name.split(' ')[0];
  return <main className="app-shell"><section className="phone-frame">
    <header className="topbar"><div><p className="eyebrow">Due Passi · Команда</p><h1>{tab === 'admin' ? 'Управление' : `Добрый день, ${firstName}`}</h1></div><button className="avatar" onClick={() => setProfileOpen(true)} aria-label="Профиль">{user.photoUrl ? <img src={user.photoUrl} alt="" /> : firstName.charAt(0).toUpperCase()}</button></header>
    <div className="content-scroll">{tab === 'menu' && <MenuView dishes={data.dishes} onSelect={setSelectedDish} />}{tab === 'test' && <TestView dishes={data.dishes.filter((dish) => !isDrink(dish.category))} user={user} selectedDishIds={testDishIds} onClearSelection={() => setTestDishIds([])} />}{tab === 'book' && <BookView />}{tab === 'admin' && <AdminView data={data} refresh={refresh} />}</div>
    <nav className="tabbar" aria-label="Основная навигация"><button className={`tab ${tab === 'menu' ? 'active' : ''}`} onClick={() => setTab('menu')}><Icon name="menu" />Меню</button><button className={`tab ${tab === 'test' ? 'active' : ''}`} onClick={() => setTab('test')}><Icon name="test" />Тест</button><button className={`tab ${tab === 'book' ? 'active' : ''}`} onClick={() => setTab('book')}><Icon name="book" />Книга</button>{user.role === 'admin' && <button className={`tab ${tab === 'admin' ? 'active' : ''}`} onClick={() => setTab('admin')}><Icon name="admin" />Админ</button>}</nav>
    {selectedDish && <DishDetail key={selectedDish.id} dish={selectedDish} onClose={() => setSelectedDish(null)} selectedForTest={testDishIds.includes(selectedDish.id)} canAddToTest={testDishIds.length < 15} onToggleTest={() => toggleTestDish(selectedDish.id)} />}
    {profileOpen && <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setProfileOpen(false)}><section className="profile-sheet"><div className="large-avatar">{user.photoUrl ? <img src={user.photoUrl} alt="" /> : firstName.charAt(0)}</div><h2>{user.name}</h2>{user.username && <span className="profile-username">@{user.username}</span>}<p>{user.role === 'admin' ? 'Администратор' : 'Официант'} · Due Passi</p><button className="secondary-button danger" onClick={logout}>Выйти из профиля</button></section></div>}
  </section></main>;
}
