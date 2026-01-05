import React, { useState } from 'react';
import { generateCreativeContent, generateStoryAnalysis, CreativeContent, QuizQuestion as ServiceQuizQuestion } from './services/geminiService';
import Loader from './components/Loader';

type AppMode = 'words' | 'full-story';

interface QuizQuestion {
    word?: string; // For vocab quiz
    questionText?: string; // For comprehension quiz
    options: string[];
    correctAnswer: string;
    userAnswer: string | null;
}

const App: React.FC = () => {
    const [mode, setMode] = useState<AppMode>('words');
    const [inputContent, setInputContent] = useState<string>('');
    const [direction, setDirection] = useState<'en-to-nl' | 'nl-to-en'>('en-to-nl');
    const [isBeginner, setIsBeginner] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<CreativeContent | null>(null);
    
    // Quiz State
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
    const [quizScore, setQuizScore] = useState<number>(0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputContent.trim()) {
            setError(`Please enter some ${mode === 'words' ? 'words' : 'story text'} to process.`);
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);
        setQuizQuestions([]);

        try {
            let content: CreativeContent;
            if (mode === 'words') {
                const inputLanguage = direction === 'en-to-nl' ? 'English' : 'Dutch';
                const translationLanguage = direction === 'en-to-nl' ? 'Dutch' : 'English';
                content = await generateCreativeContent(inputContent, inputLanguage, translationLanguage, isBeginner);
                generateVocabQuiz(content.translations);
            } else {
                content = await generateStoryAnalysis(inputContent, isBeginner);
                if (content.comprehensionQuestions) {
                    generateComprehensionQuiz(content.comprehensionQuestions);
                }
            }
            setResult(content);
            setQuizSubmitted(false);
            setQuizScore(0);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const generateVocabQuiz = (translations: { original: string; translated: string; }[]) => {
        if (translations.length < 2) {
            setQuizQuestions([]);
            return;
        }
        const allTranslatedWords = translations.map(t => t.translated);
        const shuffleArray = (array: string[]) => [...array].sort(() => Math.random() - 0.5);

        const newQuizQuestions: QuizQuestion[] = translations.map(pair => {
            const correctAnswer = pair.translated;
            const distractors = allTranslatedWords.filter(word => word !== correctAnswer);
            const options = shuffleArray([correctAnswer, ...distractors.slice(0, 3)]);

            return {
                word: pair.original,
                options,
                correctAnswer,
                userAnswer: null,
            };
        });
        setQuizQuestions(newQuizQuestions);
    };

    const generateComprehensionQuiz = (questions: ServiceQuizQuestion[]) => {
        const newQuizQuestions: QuizQuestion[] = questions.map(q => ({
            questionText: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            userAnswer: null,
        }));
        setQuizQuestions(newQuizQuestions);
    };

    const handleAnswerSelect = (questionIndex: number, selectedOption: string) => {
        if (quizSubmitted) return;
        const newQuestions = [...quizQuestions];
        newQuestions[questionIndex].userAnswer = selectedOption;
        setQuizQuestions(newQuestions);
    };

    const handleCheckQuiz = () => {
        let score = 0;
        quizQuestions.forEach(q => {
            if (q.userAnswer === q.correctAnswer) score++;
        });
        setQuizScore(score);
        setQuizSubmitted(true);
    };

    const handleTryAgain = () => {
        setQuizSubmitted(false);
        setQuizScore(0);
        const resetQuestions = quizQuestions.map(q => ({ ...q, userAnswer: null }));
        setQuizQuestions(resetQuestions);
    };

    const inputLangLabel = direction === 'en-to-nl' ? 'English' : 'Dutch';
    const translatedLangLabel = direction === 'en-to-nl' ? 'Dutch' : 'English';

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans pb-12">
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">
                        WoordKunst
                    </h1>
                    <p className="mt-3 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        Your words, reimagined. Learn Dutch through AI-generated stories, art, and personalized quizzes.
                    </p>
                </header>

                <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-6 sm:p-10 border border-gray-100 dark:border-gray-700">
                    {/* Tab Navigation */}
                    <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-2xl mb-8">
                        <button 
                            onClick={() => { setMode('words'); setResult(null); }}
                            className={`flex-1 flex items-center justify-center py-3 rounded-xl transition-all duration-300 ${mode === 'words' ? 'bg-white dark:bg-gray-800 shadow-md text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                            Vocabulary Builder
                        </button>
                        <button 
                            onClick={() => { setMode('full-story'); setResult(null); }}
                            className={`flex-1 flex items-center justify-center py-3 rounded-xl transition-all duration-300 ${mode === 'full-story' ? 'bg-white dark:bg-gray-800 shadow-md text-purple-600 dark:text-purple-400 font-bold' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                            Story Explorer
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {mode === 'words' && (
                            <div className="mb-6 animate-fadeIn">
                                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Learning Path</label>
                                <div className="flex space-x-3">
                                    <button type="button" onClick={() => setDirection('en-to-nl')} className={`flex-1 py-2 rounded-lg border-2 transition-all ${direction === 'en-to-nl' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}>English → Dutch</button>
                                    <button type="button" onClick={() => setDirection('nl-to-en')} className={`flex-1 py-2 rounded-lg border-2 transition-all ${direction === 'nl-to-en' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}>Dutch → English</button>
                                </div>
                            </div>
                        )}

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                                {mode === 'words' ? `Words to Learn (${inputLangLabel})` : 'Paste a Dutch Story to Explore'}
                            </label>
                            <textarea
                                value={inputContent}
                                onChange={(e) => setInputContent(e.target.value)}
                                placeholder={mode === 'words' ? 'e.g. coffee, bicycle, storm, morning' : 'e.g. Er was eens een kleine kat die dol was op avontuur...'}
                                rows={mode === 'words' ? 3 : 8}
                                className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-lg"
                            />
                        </div>

                        <div className="flex items-center justify-between mb-8 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-2xl">
                            <div className="flex items-center space-x-3">
                                <input
                                    type="checkbox"
                                    id="beginner-toggle"
                                    checked={isBeginner}
                                    onChange={(e) => setIsBeginner(e.target.checked)}
                                    className="h-5 w-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="beginner-toggle" className="text-sm font-medium">
                                    Beginner Mode <span className="text-xs text-gray-400 ml-1">(Simplified text & slower audio)</span>
                                </label>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full text-white font-extrabold py-4 px-6 rounded-2xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center text-lg ${mode === 'words' ? 'bg-gradient-to-r from-blue-500 to-blue-700' : 'bg-gradient-to-r from-purple-500 to-purple-700'}`}
                        >
                            {isLoading ? <Loader /> : `Generate ${mode === 'words' ? 'Word Art' : 'Story Experience'}`}
                        </button>
                    </form>
                </div>

                {error && (
                    <div className="max-w-3xl mx-auto mt-8 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-300 rounded-r-xl">
                        <p className="font-bold flex items-center"><svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg> Error</p>
                        <p>{error}</p>
                    </div>
                )}
                
                {result && !isLoading && (
                    <div className="max-w-5xl mx-auto mt-12 space-y-12 animate-fadeIn">
                        {/* Comic & Audio Hero */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden p-6 border border-gray-100 dark:border-gray-700">
                                <h2 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">Visual Inspiration</h2>
                                {result.imageUrl && <img src={result.imageUrl} alt="Generated comic" className="w-full h-auto rounded-2xl shadow-inner mb-6 hover:scale-[1.02] transition-transform duration-500" />}
                                <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-2xl">
                                    <h3 className="text-lg font-bold mb-3 flex items-center"><svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg> Podcast Narration</h3>
                                    <audio controls src={result.audioUrl} className="w-full focus:outline-none" />
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 border border-gray-100 dark:border-gray-700 h-full">
                                <h2 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">
                                    {mode === 'words' ? 'Generated Story' : 'Original Text'}
                                </h2>
                                <div className="text-xl leading-relaxed text-gray-700 dark:text-gray-300 italic serif whitespace-pre-wrap">
                                    "{result.story}"
                                </div>
                            </div>
                        </div>

                        {/* Glossary/Translations */}
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
                            <h2 className="text-2xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">
                                {mode === 'words' ? 'Vocabulary List' : 'Story Glossary'}
                            </h2>
                            <div className="flex flex-col space-y-4">
                                {result.translations.map((pair, index) => (
                                    <div key={index} className="flex items-center justify-between p-6 bg-gray-50 dark:bg-gray-700/40 rounded-2xl border border-gray-100 dark:border-gray-600 hover:shadow-md transition-all">
                                        <div className="flex-1">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Original</span>
                                            <p className="text-xl font-extrabold">{pair.original}</p>
                                        </div>
                                        <div className="px-6 text-blue-500">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                        </div>
                                        <div className="flex-1 text-right">
                                            <span className="text-xs font-bold text-blue-400 uppercase tracking-tighter">Translation</span>
                                            <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{pair.translated}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Quiz Section */}
                        {quizQuestions.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
                                <div className="flex items-center justify-between mb-10">
                                    <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">
                                        {mode === 'words' ? 'Vocabulary Quiz' : 'Comprehension Challenge'}
                                    </h2>
                                    {quizSubmitted && (
                                        <div className="px-6 py-2 bg-blue-500 text-white font-black rounded-full text-lg">
                                            {quizScore} / {quizQuestions.length}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="space-y-12">
                                    {quizQuestions.map((q, index) => (
                                        <div key={index} className="animate-slideUp" style={{ animationDelay: `${index * 100}ms` }}>
                                            <p className="text-lg font-bold mb-4 flex items-center">
                                                <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-3 text-sm">{index + 1}</span>
                                                {q.word ? (
                                                    <span>Translate <span className="text-blue-500">"{q.word}"</span> to {translatedLangLabel}:</span>
                                                ) : (
                                                    q.questionText
                                                )}
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {q.options.map((option, optIdx) => {
                                                    const isSelected = q.userAnswer === option;
                                                    const isCorrect = option === q.correctAnswer;
                                                    let classes = "p-4 rounded-xl border-2 transition-all text-left font-medium ";
                                                    
                                                    if (quizSubmitted) {
                                                        if (isCorrect) classes += "bg-green-100 border-green-500 text-green-700 dark:bg-green-900/40 dark:text-green-300";
                                                        else if (isSelected) classes += "bg-red-100 border-red-500 text-red-700 dark:bg-red-900/40 dark:text-red-300 line-through";
                                                        else classes += "bg-gray-50 border-gray-200 dark:bg-gray-700/40 dark:border-gray-600 opacity-50";
                                                    } else {
                                                        classes += isSelected 
                                                            ? "bg-blue-500 border-blue-500 text-white shadow-lg scale-[1.02]" 
                                                            : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-blue-400";
                                                    }

                                                    return (
                                                        <button
                                                            key={optIdx}
                                                            onClick={() => handleAnswerSelect(index, option)}
                                                            disabled={quizSubmitted}
                                                            className={classes}
                                                        >
                                                            {option}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-12 flex justify-center">
                                    {quizSubmitted ? (
                                        <button 
                                            onClick={handleTryAgain}
                                            className="px-10 py-4 bg-gray-800 dark:bg-gray-100 dark:text-gray-900 text-white font-black rounded-2xl hover:scale-105 transition-all"
                                        >
                                            Reset Quiz
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={handleCheckQuiz}
                                            disabled={quizQuestions.some(q => q.userAnswer === null)}
                                            className="px-10 py-4 bg-gradient-to-r from-green-500 to-teal-600 text-white font-black rounded-2xl hover:scale-105 disabled:opacity-50 transition-all shadow-xl shadow-green-500/20"
                                        >
                                            Check My Answers
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;