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

    getLoanByBookId(bookId) {
        return this.loans.find(loan => loan.bookId === bookId);
    }

    getStudentLoans(studentId) {
        return this.loans.filter(loan => loan.studentId === studentId);
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
            const modal = document.getElementById('loan-modal');
            if (e.target === modal) {
                this.closeModal();
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
                    <td>${student.name}</td>
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
        
        // 책 정보 표시
        document.getElementById('loan-book-info').innerHTML = `
            <h3>${book.title}</h3>
            <p><strong>저자:</strong> ${book.author || '저자 미상'}</p>
            <p><strong>도서번호:</strong> ${book.id}</p>
        `;

        // 학생 목록 채우기
        const studentSelect = document.getElementById('loan-student');
        studentSelect.innerHTML = '<option value="">학생을 선택하세요</option>' +
            this.library.students.map(student => 
                `<option value="${student.id}">${student.number}번 ${student.name}</option>`
            ).join('');

        // 모달 표시
        document.getElementById('loan-modal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('loan-modal').style.display = 'none';
        document.getElementById('loan-form').reset();
        this.selectedBookForLoan = null;
    }

    handleLoanBook() {
        const studentId = document.getElementById('loan-student').value;
        const days = parseInt(document.getElementById('loan-days').value);
        const note = document.getElementById('loan-note').value.trim();

        if (!studentId) {
            this.showNotification('학생을 선택해주세요.', 'error');
            return;
        }

        try {
            this.library.loanBook(this.selectedBookForLoan, studentId, days, note);
            this.closeModal();
            this.render();
            this.showNotification('대출이 완료되었습니다.', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
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
