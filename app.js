// ========================================
// 데이터 모델 및 LocalStorage 관리
// ========================================

class LibraryManager {
    constructor() {
        this.books = this.loadData('books') || [];
        this.students = this.loadData('students') || [];
        this.loans = this.loadData('loans') || [];
        this.loanHistory = this.loadData('loanHistory') || [];
    }

    loadData(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`Error loading ${key}:`, error);
            return null;
        }
    }

    saveData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error(`Error saving ${key}:`, error);
            alert('데이터 저장 중 오류가 발생했습니다.');
        }
    }

    // 도서 관리
    addBook(bookData) {
        const book = {
            id: bookData.id || this.generateBookId(),
            title: bookData.title,
            author: bookData.author || '',
            publisher: bookData.publisher || '',
            status: 'available',
            addedDate: new Date().toISOString()
        };
        
        // 중복 ID 체크
        if (this.books.find(b => b.id === book.id)) {
            throw new Error('이미 존재하는 도서 번호입니다.');
        }

        this.books.push(book);
        this.saveData('books', this.books);
        return book;
    }

    generateBookId() {
        const maxId = this.books.reduce((max, book) => {
            const match = book.id.match(/^B(\d+)$/);
            if (match) {
                const num = parseInt(match[1]);
                return num > max ? num : max;
            }
            return max;
        }, 0);
        return `B${String(maxId + 1).padStart(3, '0')}`;
    }

    deleteBook(bookId) {
        const book = this.books.find(b => b.id === bookId);
        if (book && book.status === 'loaned') {
            throw new Error('대출 중인 책은 삭제할 수 없습니다.');
        }
        this.books = this.books.filter(b => b.id !== bookId);
        this.saveData('books', this.books);
    }

    getBook(bookId) {
        return this.books.find(b => b.id === bookId);
    }

    searchBooks(query) {
        if (!query) return this.books;
        const lowerQuery = query.toLowerCase();
        return this.books.filter(book => 
            book.id.toLowerCase().includes(lowerQuery) ||
            book.title.toLowerCase().includes(lowerQuery) ||
            book.author.toLowerCase().includes(lowerQuery)
        );
    }

    // 학생 관리
    addStudent(studentData) {
        const student = {
            id: Date.now().toString(),
            number: studentData.number || this.generateStudentNumber(),
            name: studentData.name,
            addedDate: new Date().toISOString()
        };

        this.students.push(student);
        this.students.sort((a, b) => a.number - b.number);
        this.saveData('students', this.students);
        return student;
    }

    generateStudentNumber() {
        const maxNumber = this.students.reduce((max, student) => {
            return student.number > max ? student.number : max;
        }, 0);
        return maxNumber + 1;
    }

    deleteStudent(studentId) {
        const hasLoans = this.loans.some(loan => loan.studentId === studentId);
        if (hasLoans) {
            throw new Error('대출 중인 책이 있는 학생은 삭제할 수 없습니다.');
        }
        this.students = this.students.filter(s => s.id !== studentId);
        this.saveData('students', this.students);
    }

    getStudent(studentId) {
        return this.students.find(s => s.id === studentId);
    }

    addStudentsBulk(studentsData) {
        const results = {
            success: [],
            failed: []
        };

        studentsData.forEach(data => {
            try {
                const student = this.addStudent(data);
                results.success.push(student);
            } catch (error) {
                results.failed.push({ data, error: error.message });
            }
        });

        return results;
    }

    // 대출 관리
    loanBook(bookId, studentId, days = 14, note = '') {
        const book = this.getBook(bookId);
        const student = this.getStudent(studentId);

        if (!book) throw new Error('책을 찾을 수 없습니다.');
        if (!student) throw new Error('학생을 찾을 수 없습니다.');
        if (book.status === 'loaned') throw new Error('이미 대출 중인 책입니다.');

        const loanDate = new Date();
        const dueDate = new Date(loanDate);
        dueDate.setDate(dueDate.getDate() + days);

        const loan = {
            id: Date.now().toString(),
            bookId,
            studentId,
            loanDate: loanDate.toISOString(),
            dueDate: dueDate.toISOString(),
            note
        };

        this.loans.push(loan);
        book.status = 'loaned';
        
        this.saveData('loans', this.loans);
        this.saveData('books', this.books);

        return loan;
    }

    returnBook(bookId) {
        const loanIndex = this.loans.findIndex(loan => loan.bookId === bookId);
        if (loanIndex === -1) throw new Error('대출 기록을 찾을 수 없습니다.');

        const loan = this.loans[loanIndex];
        const returnDate = new Date().toISOString();

        // 이력에 추가
        this.loanHistory.push({
            ...loan,
            returnDate
        });

        // 대출 목록에서 제거
        this.loans.splice(loanIndex, 1);

        // 책 상태 변경
        const book = this.getBook(bookId);
        if (book) {
            book.status = 'available';
        }

        this.saveData('loans', this.loans);
        this.saveData('books', this.books);
        this.saveData('loanHistory', this.loanHistory);

        return loan;
    }

    deleteLoan(bookId) {
        const loanIndex = this.loans.findIndex(loan => loan.bookId === bookId);
        if (loanIndex === -1) throw new Error('대출 기록을 찾을 수 없습니다.');

        // 대출 목록에서 제거 (이력에 남기지 않음)
        this.loans.splice(loanIndex, 1);

        // 책 상태를 대출 가능으로 변경
        const book = this.getBook(bookId);
        if (book) {
            book.status = 'available';
        }

        this.saveData('loans', this.loans);
        this.saveData('books', this.books);
    }

    getLoanByBookId(bookId) {
        return this.loans.find(loan => loan.bookId === bookId);
    }

    getStudentLoans(studentId) {
        return this.loans.filter(loan => loan.studentId === studentId);
    }

    getStudentLoanHistory(studentId) {
        // 현재 대출 중인 책
        const currentLoans = this.loans.filter(loan => loan.studentId === studentId);
        
        // 반납한 책 이력
        const history = this.loanHistory.filter(loan => loan.studentId === studentId);
        
        return {
            current: currentLoans,
            history: history,
            all: [...currentLoans, ...history]
        };
    }

    hasStudentBorrowedBook(studentId, bookId) {
        // 현재 대출 중이거나 과거에 빌린 적이 있는지 확인
        const currentLoan = this.loans.some(loan => 
            loan.studentId === studentId && loan.bookId === bookId
        );
        
        const historyLoan = this.loanHistory.some(loan => 
            loan.studentId === studentId && loan.bookId === bookId
        );
        
        return { current: currentLoan, history: historyLoan };
    }

    isOverdue(dueDate) {
        return new Date(dueDate) < new Date();
    }

    getDaysUntilDue(dueDate) {
        const due = new Date(dueDate);
        const now = new Date();
        const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
        return diff;
    }

    // 통계
    getStats() {
        const totalBooks = this.books.length;
        const availableBooks = this.books.filter(b => b.status === 'available').length;
        const loanedBooks = this.loans.length;
        const overdueBooks = this.loans.filter(loan => this.isOverdue(loan.dueDate)).length;

        return {
            totalBooks,
            availableBooks,
            loanedBooks,
            overdueBooks
        };
    }

    getPopularBooks(limit = 5) {
        const bookCounts = {};
        
        this.loanHistory.forEach(loan => {
            bookCounts[loan.bookId] = (bookCounts[loan.bookId] || 0) + 1;
        });

        this.loans.forEach(loan => {
            bookCounts[loan.bookId] = (bookCounts[loan.bookId] || 0) + 1;
        });

        const sorted = Object.entries(bookCounts)
            .map(([bookId, count]) => ({
                book: this.getBook(bookId),
                count
            }))
            .filter(item => item.book)
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);

        return sorted;
    }

    getTopReaders(limit = 5) {
        const studentCounts = {};
        
        this.loanHistory.forEach(loan => {
            studentCounts[loan.studentId] = (studentCounts[loan.studentId] || 0) + 1;
        });

        this.loans.forEach(loan => {
            studentCounts[loan.studentId] = (studentCounts[loan.studentId] || 0) + 1;
        });

        const sorted = Object.entries(studentCounts)
            .map(([studentId, count]) => ({
                student: this.getStudent(studentId),
                count
            }))
            .filter(item => item.student)
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);

        return sorted;
    }

    // 데이터 내보내기/가져오기
    exportData() {
        return {
            books: this.books,
            students: this.students,
            loans: this.loans,
            loanHistory: this.loanHistory,
            exportDate: new Date().toISOString()
        };
    }

    importData(data) {
        if (data.books) {
            this.books = data.books;
            this.saveData('books', this.books);
        }
        if (data.students) {
            this.students = data.students;
            this.saveData('students', this.students);
        }
        if (data.loans) {
            this.loans = data.loans;
            this.saveData('loans', this.loans);
        }
        if (data.loanHistory) {
            this.loanHistory = data.loanHistory;
            this.saveData('loanHistory', this.loanHistory);
        }
    }

    clearAllData() {
        this.books = [];
        this.students = [];
        this.loans = [];
        this.loanHistory = [];
        
        localStorage.removeItem('books');
        localStorage.removeItem('students');
        localStorage.removeItem('loans');
        localStorage.removeItem('loanHistory');
    }
}

// ========================================
// UI 관리
// ========================================

class UIManager {
    constructor(libraryManager) {
        this.library = libraryManager;
        this.currentTab = 'loan';
        this.currentFilter = 'all';
        this.selectedBookForLoan = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.render();
    }

    setupEventListeners() {
        // 탭 전환
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });

        // 검색
        document.getElementById('search-btn').addEventListener('click', () => this.handleSearch());
        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // 필터
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderLoanedBooks();
            });
        });

        // 도서 등록 폼
        document.getElementById('book-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddBook();
        });

        // 학생 등록 폼
        document.getElementById('student-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddStudent();
        });

        // 일괄 등록 탭 전환
        document.querySelectorAll('.bulk-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.bulk-tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                document.querySelectorAll('.bulk-tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`bulk-${e.target.dataset.bulkTab}-tab`).classList.add('active');
            });
        });

        // 일괄 학생 등록 (텍스트)
        document.getElementById('bulk-student-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleBulkAddStudents();
        });

        // CSV 파일 선택
        document.getElementById('csv-upload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('csv-filename').textContent = file.name;
            }
        });

        // CSV 일괄 등록
        document.getElementById('csv-upload-btn').addEventListener('click', () => {
            this.handleCSVUpload();
        });

        // 대출 폼
        document.getElementById('loan-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLoanBook();
        });

        // 모달 닫기
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        window.addEventListener('click', (e) => {
            const loanModal = document.getElementById('loan-modal');
            const historyModal = document.getElementById('student-history-modal');
            
            if (e.target === loanModal) {
                this.closeModal();
            }
            if (e.target === historyModal) {
                this.closeStudentHistoryModal();
            }
        });

        // 데이터 관리
        document.getElementById('export-btn').addEventListener('click', () => this.exportData());
        document.getElementById('import-btn').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        document.getElementById('import-file').addEventListener('change', (e) => this.importData(e));
        document.getElementById('clear-btn').addEventListener('click', () => this.clearData());
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        // 탭 버튼 활성화
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // 탭 컨텐츠 표시
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tab}-tab`).classList.add('active');

        // 해당 탭 렌더링
        this.render();
    }

    render() {
        switch (this.currentTab) {
            case 'loan':
                this.renderAvailableBooks();
                this.renderLoanedBooks();
                break;
            case 'books':
                this.renderAllBooks();
                break;
            case 'students':
                this.renderStudents();
                break;
            case 'stats':
                this.renderStats();
                break;
        }
    }

    // 도서 렌더링
    renderAvailableBooks(books = null) {
        const container = document.getElementById('available-books');
        const booksToShow = books || this.library.books.filter(b => b.status === 'available');

        if (booksToShow.length === 0) {
            container.innerHTML = '<p class="empty-state">대출 가능한 책이 없습니다.</p>';
            return;
        }

        container.innerHTML = booksToShow.map(book => `
            <div class="book-card">
                <span class="book-id">${book.id}</span>
                <div class="book-title">${book.title}</div>
                <div class="book-author">${book.author || '저자 미상'}</div>
                <span class="book-status available">대출 가능</span>
                <div class="book-actions">
                    <button class="btn btn-primary btn-small" onclick="ui.openLoanModal('${book.id}')">
                        대출하기
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderLoanedBooks() {
        const container = document.getElementById('loaned-books');
        let loansToShow = this.library.loans;

        // 필터 적용
        if (this.currentFilter === 'normal') {
            loansToShow = loansToShow.filter(loan => !this.library.isOverdue(loan.dueDate));
        } else if (this.currentFilter === 'overdue') {
            loansToShow = loansToShow.filter(loan => this.library.isOverdue(loan.dueDate));
        }

        if (loansToShow.length === 0) {
            container.innerHTML = '<p class="empty-state">대출 중인 책이 없습니다.</p>';
            return;
        }

        container.innerHTML = loansToShow.map(loan => {
            const book = this.library.getBook(loan.bookId);
            const student = this.library.getStudent(loan.studentId);
            const isOverdue = this.library.isOverdue(loan.dueDate);
            const daysUntilDue = this.library.getDaysUntilDue(loan.dueDate);

            return `
                <div class="book-card ${isOverdue ? 'overdue' : 'loaned'}">
                    <span class="book-id">${book.id}</span>
                    <div class="book-title">${book.title}</div>
                    <div class="book-author">${book.author || '저자 미상'}</div>
                    <span class="book-status ${isOverdue ? 'overdue' : 'loaned'}">
                        ${isOverdue ? '연체' : '대출 중'}
                    </span>
                    <div class="loan-info">
                        <strong>대출자:</strong> ${student.number}번 ${student.name}<br>
                        <strong>대출일:</strong> ${this.formatDate(loan.loanDate)}<br>
                        <strong>반납 예정:</strong> ${this.formatDate(loan.dueDate)}
                        ${isOverdue ? 
                            `<div class="overdue-alert">⚠️ ${Math.abs(daysUntilDue)}일 연체</div>` :
                            `<div style="color: var(--success-color);">📅 D-${daysUntilDue}</div>`
                        }
                        ${loan.note ? `<br><strong>메모:</strong> ${loan.note}` : ''}
                    </div>
                    <div class="book-actions">
                        <button class="btn btn-success btn-small" onclick="ui.handleReturnBook('${book.id}')">
                            반납하기
                        </button>
                        <button class="btn btn-danger btn-small" onclick="ui.handleDeleteLoan('${book.id}')">
                            삭제
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderAllBooks() {
        const tbody = document.getElementById('books-table-body');
        
        if (this.library.books.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">등록된 도서가 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = this.library.books.map(book => `
            <tr>
                <td>${book.id}</td>
                <td>${book.title}</td>
                <td>${book.author || '-'}</td>
                <td>
                    <span class="status-badge ${book.status}">
                        ${book.status === 'available' ? '대출 가능' : '대출 중'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-danger btn-small" 
                            onclick="ui.handleDeleteBook('${book.id}')"
                            ${book.status === 'loaned' ? 'disabled' : ''}>
                        삭제
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderStudents() {
        const tbody = document.getElementById('students-table-body');
        
        if (this.library.students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">등록된 학생이 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = this.library.students.map(student => {
            const loanCount = this.library.getStudentLoans(student.id).length;
            return `
                <tr>
                    <td>${student.number}</td>
                    <td>
                        <span class="student-name-link" onclick="ui.showStudentHistory('${student.id}')">
                            ${student.name}
                        </span>
                    </td>
                    <td>${loanCount}권</td>
                    <td>
                        <button class="btn btn-danger btn-small" 
                                onclick="ui.handleDeleteStudent('${student.id}')"
                                ${loanCount > 0 ? 'disabled' : ''}>
                            삭제
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderStats() {
        const stats = this.library.getStats();
        
        document.getElementById('total-books').textContent = stats.totalBooks;
        document.getElementById('available-count').textContent = stats.availableBooks;
        document.getElementById('loaned-count').textContent = stats.loanedBooks;
        document.getElementById('overdue-count').textContent = stats.overdueBooks;

        // 인기 도서
        const popularBooks = this.library.getPopularBooks();
        const popularContainer = document.getElementById('popular-books');
        
        if (popularBooks.length === 0) {
            popularContainer.innerHTML = '<p class="empty-state">대출 이력이 없습니다.</p>';
        } else {
            popularContainer.innerHTML = popularBooks.map((item, index) => `
                <div class="popular-item">
                    <div class="popular-rank">${index + 1}</div>
                    <div class="popular-info">
                        <div class="popular-name">${item.book.title}</div>
                        <div class="popular-count">대출 ${item.count}회</div>
                    </div>
                </div>
            `).join('');
        }

        // 다독왕
        const topReaders = this.library.getTopReaders();
        const readersContainer = document.getElementById('top-readers');
        
        if (topReaders.length === 0) {
            readersContainer.innerHTML = '<p class="empty-state">대출 이력이 없습니다.</p>';
        } else {
            readersContainer.innerHTML = topReaders.map((item, index) => `
                <div class="popular-item">
                    <div class="popular-rank">${index + 1}</div>
                    <div class="popular-info">
                        <div class="popular-name">${item.student.number}번 ${item.student.name}</div>
                        <div class="popular-count">대출 ${item.count}회</div>
                    </div>
                </div>
            `).join('');
        }
    }

    // 이벤트 핸들러
    handleSearch() {
        const query = document.getElementById('search-input').value;
        const results = this.library.searchBooks(query);
        const availableResults = results.filter(b => b.status === 'available');
        this.renderAvailableBooks(availableResults);
    }

    handleAddBook() {
        const bookData = {
            id: document.getElementById('book-id').value.trim(),
            title: document.getElementById('book-title').value.trim(),
            author: document.getElementById('book-author').value.trim(),
            publisher: document.getElementById('book-publisher').value.trim()
        };

        try {
            this.library.addBook(bookData);
            document.getElementById('book-form').reset();
            this.render();
            this.showNotification('도서가 등록되었습니다.', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    handleDeleteBook(bookId) {
        if (!confirm('정말 이 도서를 삭제하시겠습니까?')) return;

        try {
            this.library.deleteBook(bookId);
            this.render();
            this.showNotification('도서가 삭제되었습니다.', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    handleAddStudent() {
        const studentData = {
            number: parseInt(document.getElementById('student-number').value) || null,
            name: document.getElementById('student-name').value.trim()
        };

        try {
            this.library.addStudent(studentData);
            document.getElementById('student-form').reset();
            this.render();
            this.showNotification('학생이 추가되었습니다.', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    handleBulkAddStudents() {
        const text = document.getElementById('bulk-student-text').value.trim();
        if (!text) {
            this.showNotification('학생 목록을 입력해주세요.', 'error');
            return;
        }

        const studentsData = this.parseStudentText(text);
        if (studentsData.length === 0) {
            this.showNotification('올바른 형식의 학생 정보가 없습니다.', 'error');
            return;
        }

        const results = this.library.addStudentsBulk(studentsData);
        
        let message = `총 ${studentsData.length}명 중 ${results.success.length}명 등록 완료!`;
        if (results.failed.length > 0) {
            message += `\n실패: ${results.failed.length}명`;
        }

        document.getElementById('bulk-student-text').value = '';
        this.render();
        this.showNotification(message, results.failed.length === 0 ? 'success' : 'warning');
    }

    parseStudentText(text) {
        const lines = text.split('\n').filter(line => line.trim());
        const students = [];

        lines.forEach(line => {
            line = line.trim();
            if (!line) return;

            // 탭이나 여러 공백으로 구분
            const parts = line.split(/[\t\s]+/);
            
            if (parts.length === 1) {
                // 이름만 있는 경우
                students.push({
                    number: null,
                    name: parts[0]
                });
            } else if (parts.length >= 2) {
                // 번호와 이름이 있는 경우
                const firstPart = parts[0];
                const isNumber = /^\d+$/.test(firstPart);
                
                if (isNumber) {
                    students.push({
                        number: parseInt(firstPart),
                        name: parts.slice(1).join(' ')
                    });
                } else {
                    // 첫 부분이 숫자가 아니면 전체를 이름으로
                    students.push({
                        number: null,
                        name: parts.join(' ')
                    });
                }
            }
        });

        return students;
    }

    handleCSVUpload() {
        const fileInput = document.getElementById('csv-upload');
        const file = fileInput.files[0];

        if (!file) {
            this.showNotification('파일을 선택해주세요.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const studentsData = this.parseCSV(text);
                
                if (studentsData.length === 0) {
                    this.showNotification('올바른 형식의 학생 정보가 없습니다.', 'error');
                    return;
                }

                const results = this.library.addStudentsBulk(studentsData);
                
                let message = `총 ${studentsData.length}명 중 ${results.success.length}명 등록 완료!`;
                if (results.failed.length > 0) {
                    message += `\n실패: ${results.failed.length}명`;
                }

                fileInput.value = '';
                document.getElementById('csv-filename').textContent = '파일을 선택하세요';
                this.render();
                this.showNotification(message, results.failed.length === 0 ? 'success' : 'warning');
            } catch (error) {
                this.showNotification('파일을 읽는 중 오류가 발생했습니다.', 'error');
            }
        };
        reader.readAsText(file, 'UTF-8');
    }

    parseCSV(text) {
        const lines = text.split('\n').filter(line => line.trim());
        const students = [];

        lines.forEach(line => {
            line = line.trim();
            if (!line) return;

            // CSV는 쉼표로 구분
            const parts = line.split(',').map(p => p.trim());
            
            if (parts.length === 1) {
                // 이름만 있는 경우
                students.push({
                    number: null,
                    name: parts[0]
                });
            } else if (parts.length >= 2) {
                // 번호와 이름이 있는 경우
                const firstPart = parts[0];
                const isNumber = /^\d+$/.test(firstPart);
                
                if (isNumber) {
                    students.push({
                        number: parseInt(firstPart),
                        name: parts[1]
                    });
                } else {
                    // 첫 부분이 숫자가 아니면 전체를 이름으로
                    students.push({
                        number: null,
                        name: parts.join(' ')
                    });
                }
            }
        });

        return students;
    }

    handleDeleteStudent(studentId) {
        if (!confirm('정말 이 학생을 삭제하시겠습니까?')) return;

        try {
            this.library.deleteStudent(studentId);
            this.render();
            this.showNotification('학생이 삭제되었습니다.', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    openLoanModal(bookId) {
        this.selectedBookForLoan = bookId;
        const book = this.library.getBook(bookId);
        
        console.log('[모달 열기] 책:', book.title);
        
        // 책 정보 표시
        document.getElementById('loan-book-info').innerHTML = `
            <h3>${book.title}</h3>
            <p><strong>저자:</strong> ${book.author || '저자 미상'}</p>
            <p><strong>도서번호:</strong> ${book.id}</p>
        `;

        // 경고 박스 초기화 (먼저!)
        const alertBox = document.getElementById('student-history-alert');
        alertBox.style.display = 'none';
        alertBox.innerHTML = '';

        // 학생 목록 채우기
        const studentSelect = document.getElementById('loan-student');
        
        // 기존 이벤트 리스너 제거를 위해 복제본으로 교체
        const newStudentSelect = studentSelect.cloneNode(false);
        studentSelect.parentNode.replaceChild(newStudentSelect, studentSelect);
        
        // 학생 목록을 번호순으로 정렬
        const sortedStudents = [...this.library.students].sort((a, b) => a.number - b.number);
        
        console.log('[모달 열기] 학생 목록:', sortedStudents.map(s => `${s.number}번 ${s.name}`));
        
        newStudentSelect.innerHTML = '<option value="">학생을 선택하세요</option>' +
            sortedStudents.map(student => 
                `<option value="${student.id}">${student.number}번 ${student.name}</option>`
            ).join('');

        // 학생 선택 이벤트 리스너 (새로운 요소에 추가)
        newStudentSelect.addEventListener('change', (e) => {
            const selectedId = e.target.value;
            console.log('[드롭다운 변경] 선택된 ID:', selectedId);
            this.checkStudentBookHistory(selectedId, bookId);
        });

        // required 속성 복원
        newStudentSelect.required = true;
        newStudentSelect.id = 'loan-student';

        // 모달 표시
        document.getElementById('loan-modal').style.display = 'block';
    }

    checkStudentBookHistory(studentId, bookId) {
        const alertBox = document.getElementById('student-history-alert');
        
        console.log('[경고박스] 체크 시작 - studentId:', studentId);
        
        if (!studentId) {
            alertBox.style.display = 'none';
            return;
        }

        const student = this.library.getStudent(studentId);
        const book = this.library.getBook(bookId);
        
        console.log('[경고박스] 찾은 학생:', student ? `${student.number}번 ${student.name}` : 'null');
        
        if (!student) {
            alertBox.style.display = 'none';
            return;
        }
        
        const borrowHistory = this.library.hasStudentBorrowedBook(studentId, bookId);

        if (borrowHistory.current) {
            // 현재 대출 중
            alertBox.className = 'alert-box danger';
            alertBox.innerHTML = `
                <strong>⚠️ 중복 대출 불가</strong>
                ${student.number}번 ${student.name} 학생이 현재 이 책을 대출 중입니다!
            `;
            alertBox.style.display = 'block';
        } else if (borrowHistory.history) {
            // 과거에 빌린 적 있음
            alertBox.className = 'alert-box warning';
            alertBox.innerHTML = `
                <strong>📚 대출 이력 있음</strong>
                ${student.number}번 ${student.name} 학생이 이 책을 이전에 빌린 적이 있습니다.
            `;
            alertBox.style.display = 'block';
        } else {
            // 처음 빌리는 책
            alertBox.className = 'alert-box info';
            alertBox.innerHTML = `
                <strong>✨ 첫 대출</strong>
                ${student.number}번 ${student.name} 학생이 이 책을 처음 빌립니다.
            `;
            alertBox.style.display = 'block';
        }
    }

    showStudentHistory(studentId) {
        const student = this.library.getStudent(studentId);
        if (!student) return;

        const history = this.library.getStudentLoanHistory(studentId);
        
        // 학생 정보 표시
        document.getElementById('student-history-info').innerHTML = `
            <h3>${student.number}번 ${student.name}</h3>
            <p>총 대출 횟수: ${history.all.length}권 (현재 ${history.current.length}권 대출 중)</p>
        `;

        let contentHTML = '';

        // 현재 대출 중인 책
        if (history.current.length > 0) {
            contentHTML += `
                <div class="history-section">
                    <h3>📕 현재 대출 중 (${history.current.length}권)</h3>
                    <div class="history-list">
            `;

            history.current.forEach(loan => {
                const book = this.library.getBook(loan.bookId);
                const isOverdue = this.library.isOverdue(loan.dueDate);
                const daysUntilDue = this.library.getDaysUntilDue(loan.dueDate);

                contentHTML += `
                    <div class="history-item ${isOverdue ? 'overdue' : 'current'}">
                        <div class="history-book-title">
                            ${book.title}
                            <span class="history-book-id">${book.id}</span>
                        </div>
                        <div class="history-dates">
                            📅 대출일: ${this.formatDate(loan.loanDate)}<br>
                            📅 반납 예정: ${this.formatDate(loan.dueDate)}
                            ${isOverdue ? 
                                ` <strong style="color: var(--danger-color);">(${Math.abs(daysUntilDue)}일 연체)</strong>` :
                                ` (D-${daysUntilDue})`
                            }
                        </div>
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px;">
                            <span class="history-status ${isOverdue ? 'overdue' : 'current'}">
                                ${isOverdue ? '⚠️ 연체 중' : '📖 대출 중'}
                            </span>
                            <button class="btn btn-danger btn-small" onclick="ui.handleDeleteLoan('${book.id}'); ui.showStudentHistory('${studentId}');">
                                삭제
                            </button>
                        </div>
                    </div>
                `;
            });

            contentHTML += `
                    </div>
                </div>
            `;
        }

        // 반납한 책 이력
        if (history.history.length > 0) {
            contentHTML += `
                <div class="history-section">
                    <h3>✅ 반납 완료 (${history.history.length}권)</h3>
                    <div class="history-list">
            `;

            // 최근 반납 순으로 정렬
            const sortedHistory = [...history.history].sort((a, b) => 
                new Date(b.returnDate) - new Date(a.returnDate)
            );

            sortedHistory.forEach(loan => {
                const book = this.library.getBook(loan.bookId);
                if (!book) return; // 삭제된 책은 스킵

                contentHTML += `
                    <div class="history-item returned">
                        <div class="history-book-title">
                            ${book.title}
                            <span class="history-book-id">${book.id}</span>
                        </div>
                        <div class="history-dates">
                            📅 대출: ${this.formatDate(loan.loanDate)} ~ ${this.formatDate(loan.returnDate)}
                        </div>
                        <span class="history-status returned">✅ 반납 완료</span>
                    </div>
                `;
            });

            contentHTML += `
                    </div>
                </div>
            `;
        }

        if (history.all.length === 0) {
            contentHTML = '<p class="empty-state">아직 대출 이력이 없습니다.</p>';
        }

        document.getElementById('student-history-content').innerHTML = contentHTML;
        document.getElementById('student-history-modal').style.display = 'block';
    }

    closeStudentHistoryModal() {
        document.getElementById('student-history-modal').style.display = 'none';
    }

    closeModal() {
        document.getElementById('loan-modal').style.display = 'none';
        document.getElementById('loan-form').reset();
        document.getElementById('student-history-alert').style.display = 'none';
        this.selectedBookForLoan = null;
    }

    handleLoanBook() {
        const studentSelect = document.getElementById('loan-student');
        const studentId = studentSelect.value;
        const days = parseInt(document.getElementById('loan-days').value);
        const note = document.getElementById('loan-note').value.trim();

        // 디버깅: 선택된 옵션 확인
        const selectedOption = studentSelect.options[studentSelect.selectedIndex];
        console.log('==========================================');
        console.log('=== 대출 처리 시작 ===');
        console.log('선택된 studentId:', studentId);
        console.log('선택된 옵션 텍스트:', selectedOption ? selectedOption.text : 'none');
        console.log('selectedIndex:', studentSelect.selectedIndex);
        console.log('전체 학생 목록:');
        this.library.students.forEach(s => {
            console.log(`  - ID: ${s.id}, 번호: ${s.number}, 이름: ${s.name}`);
        });

        if (!studentId || studentId === '') {
            alert('학생을 선택해주세요.');
            return;
        }

        const student = this.library.getStudent(studentId);
        const book = this.library.getBook(this.selectedBookForLoan);
        
        console.log('>>> 찾은 학생 정보:');
        console.log('   ID:', student ? student.id : 'null');
        console.log('   번호:', student ? student.number : 'null');
        console.log('   이름:', student ? student.name : 'null');
        
        if (!student) {
            alert('학생 정보를 찾을 수 없습니다.\n개발자 콘솔을 확인해주세요.');
            console.error('!!! 학생을 찾을 수 없음. ID:', studentId);
            console.error('!!! 현재 학생 목록:', this.library.students);
            return;
        }

        // 중복 대출 체크
        const borrowHistory = this.library.hasStudentBorrowedBook(studentId, this.selectedBookForLoan);
        if (borrowHistory.current) {
            alert(`${student.number}번 ${student.name} 학생이 이미 대출 중인 책입니다!`);
            return;
        }

        try {
            console.log('>>> 대출 처리 직전:');
            console.log('   학생:', student.number, student.name);
            console.log('   학생ID:', studentId);
            console.log('   책:', book.title);
            console.log('   책ID:', this.selectedBookForLoan);
            
            this.library.loanBook(this.selectedBookForLoan, studentId, days, note);
            
            // 대출 처리 후 확인
            const loan = this.library.getLoanByBookId(this.selectedBookForLoan);
            console.log('>>> 대출 처리 완료 - 저장된 대출 정보:');
            console.log('   대출 레코드:', loan);
            
            if (loan) {
                const loanedStudent = this.library.getStudent(loan.studentId);
                console.log('   대출된 학생:', loanedStudent);
                
                const message = `✅ 대출 완료!\n\n📚 ${book.title}\n👤 ${loanedStudent.number}번 ${loanedStudent.name}`;
                
                console.log('>>> 알림 메시지:', message);
                console.log('==========================================');
                
                this.closeModal();
                this.render();
                
                setTimeout(() => {
                    alert(message);
                }, 100);
            }
        } catch (error) {
            console.error('!!! 대출 처리 오류:', error);
            alert('오류: ' + error.message);
        }
    }

    handleReturnBook(bookId) {
        if (!confirm('이 책을 반납 처리하시겠습니까?')) return;

        try {
            this.library.returnBook(bookId);
            this.render();
            this.showNotification('반납이 완료되었습니다.', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    handleDeleteLoan(bookId) {
        const loan = this.library.getLoanByBookId(bookId);
        if (!loan) {
            this.showNotification('대출 기록을 찾을 수 없습니다.', 'error');
            return;
        }

        const book = this.library.getBook(bookId);
        const student = this.library.getStudent(loan.studentId);

        if (!confirm(`정말 이 대출 기록을 삭제하시겠습니까?\n\n📚 ${book.title}\n👤 ${student.number}번 ${student.name}\n\n⚠️ 이 작업은 되돌릴 수 없으며, 대출 이력에도 남지 않습니다.`)) {
            return;
        }

        try {
            this.library.deleteLoan(bookId);
            this.render();
            this.showNotification('대출 기록이 삭제되었습니다.', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    exportData() {
        const data = this.library.exportData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `library-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('데이터를 내보냈습니다.', 'success');
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (confirm('기존 데이터를 모두 덮어쓰시겠습니까?')) {
                    this.library.importData(data);
                    this.render();
                    this.showNotification('데이터를 가져왔습니다.', 'success');
                }
            } catch (error) {
                this.showNotification('올바른 형식의 파일이 아닙니다.', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    clearData() {
        if (!confirm('정말 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다!')) return;
        if (!confirm('다시 한번 확인합니다. 정말 삭제하시겠습니까?')) return;

        this.library.clearAllData();
        this.render();
        this.showNotification('모든 데이터가 삭제되었습니다.', 'success');
    }

    showNotification(message, type = 'info') {
        alert(message);
    }

    formatDate(isoString) {
        const date = new Date(isoString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}

// ========================================
// 앱 초기화
// ========================================

const library = new LibraryManager();
const ui = new UIManager(library);
