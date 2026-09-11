/* ============================================================================
 * PROTOTYPE PHÂN BỔ PHÒNG HỌC – app.js (JavaScript thuần)
 *
 * Cấu trúc file:
 *   1. Hằng số & cấu hình
 *   2. Dữ liệu test (dataset từ Google Sheets + dataset tổng hợp)
 *   3. Thuật toán phân phòng (các function nhỏ, thuần – không đụng DOM)
 *   4. Kiểm tra invariant
 *   5. Test case (mục 22 trong đề bài)
 *   6. Giao diện (render)
 *   7. Khởi tạo
 *
 * Nguyên tắc bất biến của thuật toán:
 *   - KHÔNG đổi Thứ, KHÔNG đổi Tiết của TKB.
 *   - KHÔNG xếp lớp vào phòng thiếu chỗ.
 *   - KHÔNG cho 2 lớp khác nhau dùng chung phòng cùng thời điểm (trừ khi GHÉP).
 *   - KHÔNG xóa lớp; lớp không xếp được chỉ bị đánh dấu "Đề xuất hủy".
 * ========================================================================== */

'use strict';

/* ============================================================================
 * 1. HẰNG SỐ & CẤU HÌNH
 * ========================================================================== */

/** Bật/tắt console.log chi tiết. Có thể đổi bằng checkbox trên giao diện. */
let DEBUG = true;

const STATUS = {
  ASSIGNED: 'ASSIGNED',
  UNASSIGNED: 'UNASSIGNED',
  MERGED: 'MERGED',
  CANCEL_CANDIDATE: 'CANCEL_CANDIDATE',
};

const STATUS_LABEL = {
  ASSIGNED: 'Đã phân phòng',
  UNASSIGNED: 'Chưa phân phòng',
  MERGED: 'Đã ghép',
  CANCEL_CANDIDATE: 'Đề xuất hủy',
};

const ROOM_TYPE_LABEL = {
  normal: 'Thường',
  computer: 'Phòng máy',
  laboratory: 'Thí nghiệm',
};

const DAYS = [2, 3, 4, 5, 6, 7];

/* ============================================================================
 * 2. DỮ LIỆU TEST
 * ========================================================================== */

/* ---- 2a. Dataset lấy từ Google Sheets của người dùng --------------------
 * Sheet chỉ cho biết tên lớp (chính là học phần), sĩ số, tiết BD/KT và Thứ.
 * Không có thông tin loại phòng -> mặc định "normal".
 * Lớp học 2 ngày (vd "2&3") được tách thành 2 buổi, mỗi buổi là một bản ghi
 * độc lập (cùng className, cùng course) – TKB vẫn được giữ nguyên.
 * Học phần được suy ra bằng cách bỏ hậu tố " lớp N" để các lớp
 * "Tư tưởng HCM", "Tư tưởng HCM lớp 2", ... được coi là cùng học phần khi ghép.
 * ------------------------------------------------------------------------- */
const SHEET_ROOMS_RAW = [
  ['P102', 40], ['P501', 40], ['P503', 40],
  ['P302', 45], ['P403', 45], ['P504', 45],
  ['P104', 50], ['P303', 50],
  ['P201', 55], ['P405', 55], ['P505', 55],
  ['P203', 60], ['P305', 60],
  ['P204', 65],
  ['P205', 70], ['P401', 70],
  ['P101', 80], ['P402', 80],
];

// [STT, Tên lớp, Sĩ số, Tiết BD, Tiết KT, [các Thứ]]
const SHEET_CLASSES_RAW = [
  [1, 'LUẬT TM', 80, 4, 5, [6]],
  [2, 'Truyền thông', 80, 11, 13, [2]],
  [3, 'Tư tưởng HCM lớp 3', 80, 8, 9, [5]],
  [4, 'Tư tưởng HCM', 73, 8, 9, [3]],
  [5, 'Tư tưởng HCM lớp 2', 73, 3, 4, [5]],
  [6, 'Tổ chức sự kiện', 72, 11, 13, [3]],
  [7, 'Văn bản QLNN', 72, 10, 13, [2]],
  [8, 'Văn hóa gia đình', 70, 6, 8, [2]],
  [9, 'Dàn dựng', 69, 1, 3, [3]],
  [10, 'TA3 Lớp 2', 69, 6, 9, [2, 3]],
  [11, 'LSĐ', 66, 6, 7, [5]],
  [12, 'Tổ chức bộ máy', 64, 3, 5, [4]],
  [13, 'Luật Hành chính', 63, 11, 13, [3]],
  [27, 'Python 1', 46, 1, 4, [6]],
  [28, 'OOP', 45, 10, 13, [3]],
  [29, 'AI lớp 2', 45, 10, 13, [3]],
  [30, 'Văn hóa chính trị', 45, 11, 13, [6]],
  [31, 'PTHTTT', 40, 1, 4, [2, 3]],
  [32, 'XDD về CT', 40, 6, 8, [4]],
  [33, 'HDH LỚP 2', 40, 6, 8, [2]],
  [34, 'HDH', 38, 6, 8, [6]],
  [35, 'OOP lớp 2', 38, 6, 9, [6]],
  [36, 'Bảo trì hệ thống', 37, 1, 3, [4]],
  [37, 'CTDLVGT', 35, 10, 13, [5]],
  [38, 'Hệ CSDL', 35, 6, 9, [4, 5]],
  [39, 'XDD về TC', 35, 11, 13, [3]],
  [40, 'Kiến trúc máy tính', 35, 1, 3, [4]],
];

/** "Tư tưởng HCM lớp 3" -> "Tư tưởng HCM"; "HDH LỚP 2" -> "HDH". */
function deriveCourseName(className) {
  return className.replace(/\s*l[ớỚ]p\s*\d+\s*$/i, '').trim();
}

function buildSheetDataset() {
  const rooms = SHEET_ROOMS_RAW.map(([id, capacity]) => ({ id, name: id, capacity, type: 'normal' }));
  const classes = [];
  for (const [stt, name, sv, start, end, days] of SHEET_CLASSES_RAW) {
    for (const day of days) {
      classes.push({
        id: days.length > 1 ? `TKB${stt}-T${day}` : `TKB${stt}`,
        className: name,
        course: deriveCourseName(name),
        day,
        startPeriod: start,
        endPeriod: end,
        studentCount: sv,
        roomType: 'normal',
      });
    }
  }
  return {
    key: 'sheet',
    label: 'TKB thực tế (Google Sheets)',
    description: `${rooms.length} phòng thường (40–80 chỗ), ${classes.length} buổi học từ ${SHEET_CLASSES_RAW.length} lớp. ` +
      'Lớp học 2 ngày được tách thành 2 buổi.',
    rooms,
    classes,
  };
}

/* ---- 2b. Dataset tổng hợp – cố tình tạo các tình huống kiểm thử -----------
 *  (1) Phân phòng bình thường          -> đa số lớp
 *  (2) Nhiều lớp cùng thời điểm        -> Thứ 2 tiết 1-3 có 8 lớp
 *  (3) Lớp đông sinh viên              -> KT01 (100 SV), KT02 (95 SV)
 *  (4) Lớp không đủ phòng              -> CNTT08 Python 120 SV (không phòng nào >= 120)
 *  (5) Cùng học phần để ghép           -> "Tin học cơ sở" Thứ 4 tiết 1-3 (phòng máy đã hết)
 *  (6) Không thể ghép -> đề xuất hủy   -> CNTT15 (15 SV, vượt sức chứa), HH03, VL01 (phòng thí nghiệm)
 *  (7) Trùng tiết                      -> CNTT05 học tiết 2-4 chồng lên khung 1-3
 *  (8) Nhiều phòng đủ điều kiện (Best Fit) -> CNTT01 43 SV, có phòng 50/60/80/100 trống
 * ------------------------------------------------------------------------- */
const SYNTHETIC_ROOMS = [
  { id: 'P101', name: 'P101', capacity: 30, type: 'normal' },
  { id: 'P102', name: 'P102', capacity: 40, type: 'normal' },
  { id: 'P103', name: 'P103', capacity: 50, type: 'normal' },
  { id: 'P104', name: 'P104', capacity: 60, type: 'normal' },
  { id: 'P105', name: 'P105', capacity: 80, type: 'normal' },
  { id: 'P106', name: 'P106', capacity: 100, type: 'normal' },
  { id: 'P201', name: 'P201', capacity: 30, type: 'normal' },
  { id: 'P202', name: 'P202', capacity: 40, type: 'normal' },
  { id: 'P203', name: 'P203', capacity: 50, type: 'normal' },
  { id: 'P204', name: 'P204', capacity: 60, type: 'normal' },
  { id: 'P205', name: 'P205', capacity: 80, type: 'normal' },
  { id: 'P301', name: 'P301', capacity: 50, type: 'normal' },
  { id: 'P302', name: 'P302', capacity: 60, type: 'normal' },
  { id: 'P303', name: 'P303', capacity: 40, type: 'normal' },
  { id: 'P304', name: 'P304', capacity: 30, type: 'normal' },
  { id: 'P401', name: 'P401', capacity: 100, type: 'normal' },
  { id: 'P402', name: 'P402', capacity: 50, type: 'normal' },
  { id: 'M401', name: 'M401', capacity: 40, type: 'computer' },
  { id: 'M402', name: 'M402', capacity: 60, type: 'computer' },
  { id: 'M403', name: 'M403', capacity: 50, type: 'computer' },
  { id: 'LAB501', name: 'LAB501', capacity: 30, type: 'laboratory' },
  { id: 'LAB502', name: 'LAB502', capacity: 40, type: 'laboratory' },
];

// Helper rút gọn cho việc khai báo lớp
const C = (id, className, course, day, s, e, sv, roomType = 'normal') =>
  ({ id, className, course, day, startPeriod: s, endPeriod: e, studentCount: sv, roomType });

const SYNTHETIC_CLASSES = [
  // ---- Thứ 2: nhiều lớp cùng khung 1-3, test Best Fit & lớp đông ----
  C('L01', 'CNTT01', 'Cơ sở dữ liệu', 2, 1, 3, 43),          // Best Fit -> phòng 50
  C('L02', 'CNTT02', 'Lập trình Java', 2, 1, 3, 70),
  C('L03', 'KT01', 'Kinh tế vi mô', 2, 1, 3, 100),           // lớp đông -> phòng 100
  C('L04', 'CNTT03', 'Cơ sở dữ liệu', 2, 1, 3, 28),
  C('L05', 'QT01', 'Quản trị học', 2, 1, 3, 55),
  C('L06', 'NN01', 'Tiếng Anh 1', 2, 1, 3, 35),
  C('L07', 'CNTT04', 'Tin học cơ sở', 2, 1, 3, 38, 'computer'),
  C('L08', 'KT02', 'Kinh tế vĩ mô', 2, 1, 3, 95),            // lớp đông thứ 2 -> phòng 100 còn lại
  C('L09', 'CNTT05', 'Mạng máy tính', 2, 2, 4, 45),          // TRÙNG TIẾT với khung 1-3
  C('L10', 'QT02', 'Marketing', 2, 4, 6, 60),
  C('L11', 'CNTT06', 'Lập trình Java', 2, 4, 6, 40),
  C('L12', 'NN02', 'Tiếng Anh 2', 2, 4, 6, 30),
  C('L13', 'KT03', 'Kế toán', 2, 7, 9, 75),
  C('L14', 'CNTT07', 'Cấu trúc dữ liệu', 2, 7, 9, 50, 'computer'),
  C('L15', 'QT03', 'Quản trị nhân sự', 2, 10, 12, 48),

  // ---- Thứ 3: lớp 120 SV không có phòng nào chứa được -> đề xuất hủy ----
  C('L16', 'CNTT08', 'Lập trình Python', 3, 1, 3, 120),
  C('L17', 'KT04', 'Kinh tế lượng', 3, 1, 3, 65),
  C('L18', 'CNTT09', 'Trí tuệ nhân tạo', 3, 1, 3, 55, 'computer'),
  C('L19', 'NN03', 'Tiếng Anh 3', 3, 4, 6, 32),
  C('L20', 'QT04', 'Thương mại điện tử', 3, 4, 6, 58),
  C('L21', 'CNTT10', 'Hệ điều hành', 3, 7, 9, 42),
  C('L22', 'KT05', 'Tài chính doanh nghiệp', 3, 7, 9, 85),

  // ---- Thứ 4: 5 lớp Tin học cơ sở cần phòng máy nhưng chỉ có 3 phòng máy ----
  //      -> 3 lớp lớn chiếm phòng, lớp 5 SV được GHÉP, lớp 15 SV -> ĐỀ XUẤT HỦY
  C('L23', 'CNTT11', 'Tin học cơ sở', 4, 1, 3, 40, 'computer'),
  C('L24', 'CNTT12', 'Tin học cơ sở', 4, 1, 3, 55, 'computer'),
  C('L25', 'CNTT13', 'Tin học cơ sở', 4, 1, 3, 45, 'computer'),
  C('L26', 'CNTT14', 'Tin học cơ sở', 4, 1, 3, 5, 'computer'),
  C('L27', 'CNTT15', 'Tin học cơ sở', 4, 1, 3, 15, 'computer'),
  C('L28', 'QT05', 'Kỹ năng mềm', 4, 4, 6, 90),
  C('L29', 'KT06', 'Nguyên lý kế toán', 4, 4, 6, 70),
  C('L30', 'NN04', 'Tiếng Anh 4', 4, 7, 9, 25),

  // ---- Thứ 5: phòng thí nghiệm – 2 phòng LAB đã đầy, 2 lớp còn lại không ghép được ----
  C('L31', 'HH01', 'Hóa phân tích', 5, 4, 6, 30, 'laboratory'),
  C('L32', 'HH02', 'Hóa phân tích', 5, 4, 6, 40, 'laboratory'),
  C('L33', 'HH03', 'Hóa phân tích', 5, 4, 6, 15, 'laboratory'),   // cùng học phần nhưng vượt sức chứa
  C('L34', 'VL01', 'Vật lý đại cương', 5, 4, 6, 20, 'laboratory'), // khác học phần -> không ghép
  C('L35', 'CNTT16', 'Công nghệ phần mềm', 5, 1, 3, 62),
  C('L36', 'KT07', 'Thống kê', 5, 1, 3, 52),
  C('L37', 'QT06', 'Luật kinh tế', 5, 7, 9, 78),

  // ---- Thứ 6 ----
  C('L38', 'CNTT17', 'Lập trình Web', 6, 1, 3, 48, 'computer'),
  C('L39', 'KT08', 'Kinh tế vi mô', 6, 1, 3, 33),
  C('L40', 'NN05', 'Tiếng Anh 5', 6, 4, 6, 29),
  C('L41', 'QT07', 'Hành vi tổ chức', 6, 4, 6, 66),
  C('L42', 'CNTT18', 'An toàn thông tin', 6, 7, 9, 44),

  // ---- Thứ 7 ----
  C('L43', 'KT09', 'Kế toán quản trị', 7, 1, 3, 57),
  C('L44', 'CNTT19', 'Đồ án 1', 7, 1, 3, 22),
  C('L45', 'QT08', 'Khởi nghiệp', 7, 4, 6, 100),
  C('L46', 'CNTT20', 'Đồ án 1', 7, 4, 6, 22),
];

const DATASETS = {
  synthetic: {
    key: 'synthetic',
    label: 'Dataset kiểm thử tổng hợp (22 phòng / 46 lớp)',
    description: '22 phòng (30–100 chỗ, gồm phòng máy & thí nghiệm), 46 lớp, 6 ngày. ' +
      'Cố tình tạo tình huống: Best Fit, trùng tiết, lớp 120 SV, ghép lớp, đề xuất hủy.',
    rooms: SYNTHETIC_ROOMS,
    classes: SYNTHETIC_CLASSES,
  },
  sheet: buildSheetDataset(),
};

/* ============================================================================
 * 3. THUẬT TOÁN PHÂN PHÒNG
 *    Tất cả function ở đây là thuần (pure), không đụng DOM.
 *    Log được đẩy vào mảng `logs` và console (nếu DEBUG).
 * ========================================================================== */

/** Ghi log vào console + mảng log của lần chạy. */
function log(logs, message) {
  logs.push(message);
  if (DEBUG) console.log('[ALLOC] ' + message);
}

const periodLabel = (c) => `${c.startPeriod}-${c.endPeriod}`;

/**
 * BƯỚC 1 – Sắp xếp TKB: Thứ tăng, Tiết bắt đầu tăng, Số SV giảm.
 * Lớp đông được xét trước để giữ phòng lớn cho lớp đông.
 * Trả về mảng mới, không làm thay đổi mảng gốc.
 */
function sortClasses(classes) {
  return [...classes].sort((a, b) =>
    a.day - b.day ||
    a.startPeriod - b.startPeriod ||
    b.studentCount - a.studentCount ||
    a.id.localeCompare(b.id) // tie-break để kết quả ổn định
  );
}

/**
 * Hai khoảng tiết trùng nhau khi cùng Thứ và:
 *   newStart <= existingEnd AND newEnd >= existingStart
 */
function isTimeConflict(dayA, startA, endA, dayB, startB, endB) {
  return dayA === dayB && startA <= endB && endA >= startB;
}

/** Phòng đã bị chiếm tại thời điểm của lớp `cls` chưa? */
function isRoomOccupied(room, cls, roomSchedule) {
  return roomSchedule.some(
    (u) => u.roomId === room.id &&
      isTimeConflict(cls.day, cls.startPeriod, cls.endPeriod, u.day, u.startPeriod, u.endPeriod)
  );
}

/** Loại phòng có phù hợp yêu cầu lớp? Lớp không yêu cầu -> dùng phòng normal. */
function isRoomTypeCompatible(room, cls) {
  const required = cls.roomType || 'normal';
  return room.type === required;
}

/**
 * BƯỚC 2 – Điều kiện phòng phù hợp. Trả về { ok, reason }.
 *   1. capacity >= studentCount
 *   2. loại phòng phù hợp
 *   3. không trùng lịch
 */
function isRoomSuitable(room, cls, roomSchedule) {
  if (room.capacity < cls.studentCount) {
    return { ok: false, reason: `sức chứa ${room.capacity} < ${cls.studentCount}` };
  }
  if (!isRoomTypeCompatible(room, cls)) {
    return { ok: false, reason: `loại phòng ${room.type} ≠ yêu cầu ${cls.roomType || 'normal'}` };
  }
  if (isRoomOccupied(room, cls, roomSchedule)) {
    return { ok: false, reason: 'bị trùng lịch' };
  }
  return { ok: true, reason: '' };
}

/** Duyệt toàn bộ phòng, trả về danh sách phòng phù hợp (có log từng phòng). */
function findAvailableRooms(cls, rooms, roomSchedule, logs) {
  const available = [];
  for (const room of rooms) {
    const { ok, reason } = isRoomSuitable(room, cls, roomSchedule);
    if (ok) {
      log(logs, `  Phòng ${room.name}: Phù hợp (waste = ${room.capacity - cls.studentCount})`);
      available.push(room);
    } else {
      log(logs, `  Phòng ${room.name}: Không phù hợp - ${reason}`);
    }
  }
  return available;
}

/**
 * BƯỚC 3 – Best Fit: chọn phòng có waste = capacity - studentCount nhỏ nhất (>= 0).
 * Nếu bằng nhau, ưu tiên mã phòng nhỏ hơn để kết quả ổn định.
 */
function selectBestRoom(cls, candidateRooms) {
  let best = null;
  let bestWaste = Infinity;
  for (const room of candidateRooms) {
    const waste = room.capacity - cls.studentCount;
    if (waste < 0) continue; // an toàn: không bao giờ chọn phòng thiếu chỗ
    if (waste < bestWaste || (waste === bestWaste && room.id < best.id)) {
      best = room;
      bestWaste = waste;
    }
  }
  return best ? { room: best, waste: bestWaste } : null;
}

/**
 * BƯỚC 4 – Phân phòng & ghi lịch sử sử dụng phòng.
 * Mỗi bản ghi lịch sử: { roomId, day, startPeriod, endPeriod, classIds[], totalStudents }
 * classIds là mảng để hỗ trợ ghép lớp (nhiều lớp cùng học phần cùng phòng).
 */
function assignRoom(cls, room, roomSchedule) {
  cls.assignedRoom = room.id;
  cls.status = STATUS.ASSIGNED;
  cls.reason = null;
  roomSchedule.push({
    roomId: room.id,
    day: cls.day,
    startPeriod: cls.startPeriod,
    endPeriod: cls.endPeriod,
    classIds: [cls.id],
    totalStudents: cls.studentCount,
  });
}

/** BƯỚC 5 – Không có phòng: đánh dấu UNASSIGNED, KHÔNG đổi Thứ/Tiết. */
function markUnassigned(cls) {
  cls.assignedRoom = null;
  cls.status = STATUS.UNASSIGNED;
  cls.reason = 'Không tìm thấy phòng phù hợp tại thời điểm TKB đã quy định';
}

/** Tìm bản ghi lịch sử của một phòng tại đúng khung Thứ + Tiết. */
function findUsageRecord(roomSchedule, roomId, day, startPeriod, endPeriod) {
  return roomSchedule.find(
    (u) => u.roomId === roomId && u.day === day &&
      u.startPeriod === startPeriod && u.endPeriod === endPeriod
  );
}

/**
 * BƯỚC 6 – Tìm lớp để ghép. Điều kiện:
 *   sameCourse AND sameDay AND samePeriod AND totalStudents <= room.capacity
 * Trong nhiều ứng viên hợp lệ, chọn phòng có waste sau ghép nhỏ nhất (Best Fit).
 * Trả về { target, room, usage } hoặc null.
 */
function findMergeCandidate(cls, classes, rooms, roomSchedule, logs) {
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]));
  let best = null;

  for (const target of classes) {
    if (target.id === cls.id) continue;
    if (target.status !== STATUS.ASSIGNED) continue; // chỉ ghép vào lớp "chủ" đã có phòng
    if (target.course !== cls.course) continue;
    if (target.day !== cls.day) continue;
    if (target.startPeriod !== cls.startPeriod || target.endPeriod !== cls.endPeriod) continue;

    log(logs, `  Tìm thấy ${target.className} (${target.id}) - cùng học phần, cùng Thứ ${cls.day}, tiết ${periodLabel(cls)}`);

    const room = roomById[target.assignedRoom];
    const usage = findUsageRecord(roomSchedule, room.id, cls.day, cls.startPeriod, cls.endPeriod);
    const total = usage.totalStudents + cls.studentCount;
    log(logs, `  Tổng SV sau ghép = ${usage.totalStudents} + ${cls.studentCount} = ${total} / sức chứa ${room.name} = ${room.capacity}`);

    if (total > room.capacity) {
      log(logs, `  -> Không ghép được vào ${room.name}: vượt sức chứa`);
      continue;
    }
    const waste = room.capacity - total;
    if (!best || waste < best.waste) best = { target, room, usage, waste };
  }
  return best;
}

/** Thực hiện ghép: cập nhật lớp và tổng SV của phòng. */
function mergeClass(cls, target, room, usage) {
  cls.status = STATUS.MERGED;
  cls.assignedRoom = room.id;
  cls.mergedWith = target.id;
  cls.reason = `Ghép vào ${target.className} (${target.id})`;
  usage.classIds.push(cls.id);
  usage.totalStudents += cls.studentCount;
}

/** Không ghép được: đánh dấu đề xuất hủy, KHÔNG xóa lớp. */
function markCancelCandidate(cls) {
  cls.status = STATUS.CANCEL_CANDIDATE;
  cls.assignedRoom = null;
  cls.reason = 'Không thể phân phòng và không tìm được phương án ghép lớp phù hợp';
}

/** Xử lý toàn bộ danh sách lớp chưa phân sau khi đã duyệt hết TKB. */
function processUnassignedClasses(unassignedClasses, classes, rooms, roomSchedule, logs) {
  if (unassignedClasses.length === 0) {
    log(logs, 'Không có lớp chưa phân – bỏ qua bước ghép.');
    return;
  }
  log(logs, `===== BƯỚC GHÉP LỚP: ${unassignedClasses.length} lớp chưa phân =====`);
  for (const cls of unassignedClasses) {
    log(logs, `Tìm phương án ghép cho ${cls.className} (${cls.id}) – ${cls.course}, ${cls.studentCount} SV`);
    const candidate = findMergeCandidate(cls, classes, rooms, roomSchedule, logs);
    if (candidate) {
      mergeClass(cls, candidate.target, candidate.room, candidate.usage);
      log(logs, `  Ghép ${cls.className} → ${candidate.room.name} (cùng ${candidate.target.className}), tổng SV = ${candidate.usage.totalStudents}`);
    } else {
      markCancelCandidate(cls);
      log(logs, `  Không có phương án ghép → ${cls.className}: ĐỀ XUẤT HỦY`);
    }
  }
}

/** Tạo bản sao lớp với trạng thái sạch (đảm bảo chạy lại không dính dữ liệu cũ). */
function resetAllocation(classes) {
  return classes.map((c) => ({
    ...c,
    roomType: c.roomType || 'normal',
    assignedRoom: null,
    status: STATUS.UNASSIGNED,
    reason: null,
    mergedWith: null,
  }));
}

/**
 * HÀM CHÍNH – chạy toàn bộ thuật toán.
 * Input : classes (TKB gốc, không bị mutate), rooms
 * Output: { classes, roomSchedule, unassignedClasses, logs }
 */
function runAllocation(inputClasses, rooms) {
  const logs = [];
  const roomSchedule = [];            // lịch sử sử dụng phòng
  const unassignedClasses = [];       // lớp chưa phân sau vòng 1

  // Reset trạng thái + sắp xếp
  const classes = sortClasses(resetAllocation(inputClasses));
  log(logs, `===== BẮT ĐẦU: ${classes.length} lớp, ${rooms.length} phòng =====`);
  log(logs, 'Thứ tự xử lý: ' + classes.map((c) => `${c.id}(T${c.day},${periodLabel(c)},${c.studentCount})`).join(' → '));

  // Vòng 1: phân phòng cho từng lớp theo thứ tự đã sắp
  for (const cls of classes) {
    log(logs, `Đang xử lý ${cls.className} (${cls.id}) – ${cls.course} | Thứ ${cls.day}, tiết ${periodLabel(cls)}, ${cls.studentCount} SV, phòng ${cls.roomType}`);
    const available = findAvailableRooms(cls, rooms, roomSchedule, logs);
    const best = selectBestRoom(cls, available);
    if (best) {
      assignRoom(cls, best.room, roomSchedule);
      log(logs, `  Chọn ${best.room.name} vì waste = ${best.waste}`);
      log(logs, `  Đã phân phòng ${cls.className} → ${best.room.name}`);
    } else {
      markUnassigned(cls);
      unassignedClasses.push(cls);
      log(logs, `  Không tìm thấy phòng cho ${cls.className}`);
      log(logs, `  Đưa ${cls.className} vào danh sách chưa phân`);
    }
  }

  // Vòng 2: xử lý lớp chưa phân (ghép hoặc đề xuất hủy)
  processUnassignedClasses(unassignedClasses, classes, rooms, roomSchedule, logs);

  const count = (s) => classes.filter((c) => c.status === s).length;
  log(logs, `===== KẾT THÚC: Đã phân ${count(STATUS.ASSIGNED)}, Ghép ${count(STATUS.MERGED)}, Đề xuất hủy ${count(STATUS.CANCEL_CANDIDATE)}, Chưa phân ${count(STATUS.UNASSIGNED)} =====`);

  return { classes, roomSchedule, unassignedClasses, logs };
}

/* ============================================================================
 * 4. KIỂM TRA INVARIANT (mục 21)
 *    Chạy sau mỗi lần phân phòng, độc lập với thuật toán.
 * ========================================================================== */
function checkInvariants(result, rooms, originalClasses) {
  const { classes, roomSchedule } = result;
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const originalById = Object.fromEntries(originalClasses.map((c) => [c.id, c]));
  const checks = [];
  const add = (name, problems) => checks.push({ name, ok: problems.length === 0, detail: problems.slice(0, 5).join('; ') });

  // 1. Một phòng không có hai bản ghi lịch sử trùng Thứ + Tiết
  const p1 = [];
  for (let i = 0; i < roomSchedule.length; i++) {
    for (let j = i + 1; j < roomSchedule.length; j++) {
      const a = roomSchedule[i], b = roomSchedule[j];
      if (a.roomId === b.roomId && isTimeConflict(a.day, a.startPeriod, a.endPeriod, b.day, b.startPeriod, b.endPeriod)) {
        p1.push(`${a.roomId}: T${a.day} ${a.startPeriod}-${a.endPeriod} vs ${b.startPeriod}-${b.endPeriod}`);
      }
    }
  }
  add('1. Một phòng không bao giờ có hai lớp trùng Thứ + Tiết (trừ lớp đã ghép, được gộp thành một bản ghi)', p1);

  // 2. Sức chứa >= tổng SV trong phòng (kể cả sau ghép) – kiểm tra lại từ danh sách lớp
  const p2 = [];
  for (const u of roomSchedule) {
    const recomputed = u.classIds.reduce((s, id) => s + classes.find((c) => c.id === id).studentCount, 0);
    if (recomputed !== u.totalStudents) p2.push(`${u.roomId}: tổng SV ghi nhận ${u.totalStudents} ≠ tính lại ${recomputed}`);
    if (recomputed > roomById[u.roomId].capacity) p2.push(`${u.roomId}: ${recomputed} SV > sức chứa ${roomById[u.roomId].capacity}`);
  }
  add('2. & 6. Phòng không bao giờ chứa nhiều SV hơn sức chứa (kể cả sau khi ghép)', p2);

  // 3 & 4. Thứ/Tiết không bị thay đổi so với TKB gốc
  const p3 = [];
  for (const c of classes) {
    const o = originalById[c.id];
    if (!o || o.day !== c.day || o.startPeriod !== c.startPeriod || o.endPeriod !== c.endPeriod) {
      p3.push(`${c.id} bị đổi thời gian`);
    }
  }
  if (classes.length !== originalClasses.length) p3.push('số lớp thay đổi');
  add('3. & 4. Lớp giữ đúng Thứ + Tiết của TKB, không lớp nào bị xóa/đổi giờ', p3);

  // 5. Lớp MERGED phải thỏa điều kiện ghép với lớp chủ
  const p5 = [];
  for (const c of classes.filter((x) => x.status === STATUS.MERGED)) {
    const t = classes.find((x) => x.id === c.mergedWith);
    if (!t || t.status !== STATUS.ASSIGNED || t.course !== c.course || t.day !== c.day ||
        t.startPeriod !== c.startPeriod || t.endPeriod !== c.endPeriod || t.assignedRoom !== c.assignedRoom) {
      p5.push(`${c.id} ghép sai điều kiện`);
    }
  }
  add('5. Lớp chỉ được ghép khi cùng học phần, cùng Thứ, cùng Tiết, cùng phòng với lớp chủ', p5);

  // 7. Trạng thái duy nhất & nhất quán với assignedRoom
  const p7 = [];
  for (const c of classes) {
    const hasRoom = c.assignedRoom != null;
    const shouldHave = c.status === STATUS.ASSIGNED || c.status === STATUS.MERGED;
    if (hasRoom !== shouldHave) p7.push(`${c.id}: ${c.status} nhưng assignedRoom = ${c.assignedRoom}`);
    if (c.status === STATUS.ASSIGNED && c.mergedWith) p7.push(`${c.id} vừa ASSIGNED vừa có mergedWith`);
  }
  add('7. Một lớp không vừa ASSIGNED vừa MERGED; trạng thái nhất quán với phòng', p7);

  // 8. Một lớp không xuất hiện ở hai phòng khác nhau
  const p8 = [];
  const seen = {};
  for (const u of roomSchedule) for (const id of u.classIds) {
    if (seen[id] && seen[id] !== u.roomId) p8.push(`${id} ở ${seen[id]} và ${u.roomId}`);
    seen[id] = u.roomId;
  }
  add('8. Một lớp không xuất hiện ở hai phòng khác nhau cùng thời điểm', p8);

  // 9. Chạy lần 2 cho kết quả y hệt (không tạo dữ liệu trùng)
  const again = runAllocationSilently(originalClasses, rooms);
  const same = again.roomSchedule.length === roomSchedule.length &&
    JSON.stringify(again.classes.map((c) => [c.id, c.status, c.assignedRoom])) ===
    JSON.stringify(classes.map((c) => [c.id, c.status, c.assignedRoom]));
  add('9. Chạy lại thuật toán cho kết quả y hệt, không tạo dữ liệu trùng', same ? [] : ['kết quả lần 2 khác lần 1']);

  return checks;
}

/** Chạy thuật toán mà không log ra console (dùng cho test/invariant). */
function runAllocationSilently(classes, rooms) {
  const prev = DEBUG;
  DEBUG = false;
  try { return runAllocation(classes, rooms); } finally { DEBUG = prev; }
}

/* ============================================================================
 * 5. TEST CASE (mục 22)
 * ========================================================================== */
const R = (id, capacity, type = 'normal') => ({ id, name: id, capacity, type });

const TEST_CASES = [
  {
    name: 'Best Fit: L001 (45 SV) phải vào P101 (50), không phải P102 (60) hay P103 (100)',
    rooms: [R('P103', 100), R('P102', 60), R('P101', 50)], // cố tình để phòng to trước
    classes: [C('L001', 'L001', 'CSDL', 2, 1, 3, 45)],
    expect: (r) => r.classes[0].assignedRoom === 'P101',
    describe: (r) => `L001 → ${r.classes[0].assignedRoom}`,
  },
  {
    name: 'Chống trùng: L001 tiết 1-3 và L002 tiết 2-4 KHÔNG được cùng P101',
    rooms: [R('P101', 50)],
    classes: [C('L001', 'L001', 'CSDL', 2, 1, 3, 40), C('L002', 'L002', 'Java', 2, 2, 4, 30)],
    expect: (r) => {
      const a = r.classes.find((c) => c.id === 'L001'), b = r.classes.find((c) => c.id === 'L002');
      return a.assignedRoom === 'P101' && b.assignedRoom !== 'P101';
    },
    describe: (r) => r.classes.map((c) => `${c.id} → ${c.assignedRoom ?? '--'} (${STATUS_LABEL[c.status]})`).join(', '),
  },
  {
    name: 'Không trùng: L001 tiết 1-3 và L002 tiết 4-6 có thể cùng dùng P101',
    rooms: [R('P101', 50)],
    classes: [C('L001', 'L001', 'CSDL', 2, 1, 3, 40), C('L002', 'L002', 'Java', 2, 4, 6, 30)],
    expect: (r) => r.classes.every((c) => c.assignedRoom === 'P101' && c.status === STATUS.ASSIGNED),
    describe: (r) => r.classes.map((c) => `${c.id} → ${c.assignedRoom ?? '--'}`).join(', '),
  },
  {
    name: 'Ghép: L001 CSDL 40 SV (P101=50) + L002 CSDL 10 SV → L002 MERGED vào P101',
    rooms: [R('P101', 50)],
    classes: [C('L001', 'L001', 'CSDL', 2, 1, 3, 40), C('L002', 'L002', 'CSDL', 2, 1, 3, 10)],
    expect: (r) => {
      const b = r.classes.find((c) => c.id === 'L002');
      return b.status === STATUS.MERGED && b.assignedRoom === 'P101' && b.mergedWith === 'L001';
    },
    describe: (r) => r.classes.map((c) => `${c.id}: ${STATUS_LABEL[c.status]} @ ${c.assignedRoom ?? '--'}`).join(', '),
  },
  {
    name: 'Không ghép: L001 CSDL 40 SV (P101=50) + L002 CSDL 20 SV → 60 > 50 → L002 ĐỀ XUẤT HỦY',
    rooms: [R('P101', 50)],
    classes: [C('L001', 'L001', 'CSDL', 2, 1, 3, 40), C('L002', 'L002', 'CSDL', 2, 1, 3, 20)],
    expect: (r) => {
      const b = r.classes.find((c) => c.id === 'L002');
      return b.status === STATUS.CANCEL_CANDIDATE && b.assignedRoom === null;
    },
    describe: (r) => r.classes.map((c) => `${c.id}: ${STATUS_LABEL[c.status]} @ ${c.assignedRoom ?? '--'}`).join(', '),
  },
  {
    name: 'Loại phòng: lớp computer không được vào phòng normal dù còn trống',
    rooms: [R('P101', 100), R('M201', 30, 'computer')],
    classes: [C('L001', 'L001', 'Tin học', 2, 1, 3, 40, 'computer')],
    expect: (r) => r.classes[0].status === STATUS.CANCEL_CANDIDATE,
    describe: (r) => `L001: ${STATUS_LABEL[r.classes[0].status]} @ ${r.classes[0].assignedRoom ?? '--'}`,
  },
  {
    name: 'Sắp xếp: cùng thời điểm, lớp 80 SV được xét trước lớp 30 SV và lấy phòng 80',
    rooms: [R('P101', 80), R('P102', 30)],
    classes: [C('L001', 'L001', 'A', 2, 1, 3, 30), C('L002', 'L002', 'B', 2, 1, 3, 80)],
    expect: (r) => r.classes.find((c) => c.id === 'L002').assignedRoom === 'P101' &&
                   r.classes.find((c) => c.id === 'L001').assignedRoom === 'P102',
    describe: (r) => r.classes.map((c) => `${c.id}(${c.studentCount}) → ${c.assignedRoom ?? '--'}`).join(', '),
  },
];

function runTestCases() {
  return TEST_CASES.map((tc) => {
    const result = runAllocationSilently(tc.classes, tc.rooms);
    return { name: tc.name, ok: tc.expect(result), detail: tc.describe(result) };
  });
}

/* ============================================================================
 * 6. GIAO DIỆN
 * ========================================================================== */
const state = {
  datasetKey: 'synthetic',
  result: null,
  dayFilter: 'all',
  statusFilter: 'all',
};

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const currentDataset = () => DATASETS[state.datasetKey];
const roomMap = () => Object.fromEntries(currentDataset().rooms.map((r) => [r.id, r]));

function renderStatistics() {
  const ds = currentDataset();
  const classes = state.result ? state.result.classes : ds.classes;
  const count = (s) => (state.result ? classes.filter((c) => c.status === s).length : '–');
  const items = [
    ['Tổng số lớp', classes.length, ''],
    ['Đã phân phòng', count(STATUS.ASSIGNED), 'ok'],
    ['Chưa phân phòng', count(STATUS.UNASSIGNED), 'warn'],
    ['Đã ghép', count(STATUS.MERGED), 'info'],
    ['Đề xuất hủy', count(STATUS.CANCEL_CANDIDATE), 'danger'],
    ['Tổng số phòng', ds.rooms.length, ''],
  ];
  $('#stats').innerHTML = items.map(([label, value, cls]) =>
    `<div class="stat ${cls}"><span class="label">${label}</span><span class="value">${value}</span></div>`
  ).join('');
}

function renderDataset() {
  const ds = currentDataset();
  $('#datasetDesc').textContent = ds.description;
  $('#roomCountBadge').textContent = ds.rooms.length;
  $('#classCountBadge').textContent = ds.classes.length;

  $('#roomList').innerHTML = [...ds.rooms]
    .sort((a, b) => a.capacity - b.capacity || a.id.localeCompare(b.id))
    .map((r) => `<span class="room-chip ${r.type}"><strong>${esc(r.name)}</strong><span class="cap">${r.capacity} chỗ</span><span class="muted">${ROOM_TYPE_LABEL[r.type]}</span></span>`)
    .join('');

  $('#inputTable tbody').innerHTML = sortClasses(ds.classes).map((c) => `
    <tr>
      <td class="num">${esc(c.id)}</td><td>${esc(c.className)}</td><td>${esc(c.course)}</td>
      <td class="num">${c.day}</td><td class="num">${periodLabel(c)}</td><td class="num">${c.studentCount}</td>
      <td>${ROOM_TYPE_LABEL[c.roomType || 'normal']}</td>
    </tr>`).join('');
}

function renderFilters() {
  const dayChips = [['all', 'Tất cả'], ...DAYS.map((d) => [String(d), `Thứ ${d}`])];
  $('#dayFilter').innerHTML = dayChips.map(([v, l]) =>
    `<button type="button" class="chip ${state.dayFilter === v ? 'active' : ''}" data-day="${v}">${l}</button>`).join('');

  const statusChips = [['all', 'Mọi trạng thái'], ...Object.keys(STATUS).map((s) => [s, STATUS_LABEL[s]])];
  $('#statusFilter').innerHTML = statusChips.map(([v, l]) =>
    `<button type="button" class="chip ${state.statusFilter === v ? 'active' : ''}" data-status="${v}">${l}</button>`).join('');
}

function renderResults() {
  const tbody = $('#resultTable tbody');
  const empty = $('#resultEmpty');
  if (!state.result) { tbody.innerHTML = ''; empty.hidden = false; return; }

  const rooms = roomMap();
  const rows = state.result.classes.filter((c) =>
    (state.dayFilter === 'all' || String(c.day) === state.dayFilter) &&
    (state.statusFilter === 'all' || c.status === state.statusFilter)
  );

  tbody.innerHTML = rows.map((c) => {
    const room = c.assignedRoom ? rooms[c.assignedRoom] : null;
    return `
      <tr>
        <td><strong>${esc(c.className)}</strong> <span class="muted">${esc(c.id)}</span></td>
        <td>${esc(c.course)}</td>
        <td class="num">${c.day}</td>
        <td class="num">${periodLabel(c)}</td>
        <td class="num">${c.studentCount}</td>
        <td class="num">${room ? esc(room.name) : '--'}</td>
        <td class="num">${room ? room.capacity : '--'}</td>
        <td><span class="status ${c.status}">${STATUS_LABEL[c.status]}</span></td>
        <td class="note">${c.reason ? esc(c.reason) : ''}</td>
      </tr>`;
  }).join('');
  empty.hidden = rows.length > 0;
  if (rows.length === 0) empty.textContent = 'Không có lớp nào khớp bộ lọc.';
}

function renderRoomHistory() {
  const tbody = $('#historyTable tbody');
  const empty = $('#historyEmpty');
  if (!state.result) { tbody.innerHTML = ''; empty.hidden = false; return; }

  const rooms = roomMap();
  const classById = Object.fromEntries(state.result.classes.map((c) => [c.id, c]));
  const usages = [...state.result.roomSchedule]
    .filter((u) => state.dayFilter === 'all' || String(u.day) === state.dayFilter)
    .sort((a, b) => a.roomId.localeCompare(b.roomId) || a.day - b.day || a.startPeriod - b.startPeriod);

  let prevRoom = null;
  tbody.innerHTML = usages.map((u) => {
    const room = rooms[u.roomId];
    const cls = u.classIds.map((id) => classById[id]);
    const first = prevRoom !== u.roomId;
    prevRoom = u.roomId;
    const pct = Math.round((u.totalStudents / room.capacity) * 100);
    return `
      <tr class="${first ? 'room-start' : ''}">
        <td><strong>${esc(room.name)}</strong> <span class="muted">${ROOM_TYPE_LABEL[room.type]}</span></td>
        <td class="num">${room.capacity}</td>
        <td class="num">${u.day}</td>
        <td class="num">${u.startPeriod}-${u.endPeriod}</td>
        <td>${cls.map((c) => `${esc(c.className)}${c.status === STATUS.MERGED ? ' <span class="status MERGED">ghép</span>' : ''}`).join(' + ')}</td>
        <td>${esc(cls[0].course)}</td>
        <td class="num">${cls.length > 1 ? cls.map((c) => c.studentCount).join(' + ') + ' = ' : ''}${u.totalStudents}</td>
        <td class="fill ${pct === 100 ? 'full' : ''}">${pct}%</td>
      </tr>`;
  }).join('');
  empty.hidden = usages.length > 0;
}

function renderCheckList(selector, checks, emptyText) {
  const el = $(selector);
  if (!checks) { el.innerHTML = `<li class="muted">${emptyText}</li>`; return; }
  el.innerHTML = checks.map((c) => `
    <li class="${c.ok ? 'pass' : 'fail'}">
      <span class="mark">${c.ok ? 'PASS' : 'FAIL'}</span>
      <span>${esc(c.name)}${c.detail ? `<span class="detail">${esc(c.detail)}</span>` : ''}</span>
    </li>`).join('');
}

function renderLog() {
  $('#logOutput').textContent = state.result ? state.result.logs.join('\n') : '';
}

function renderAll() {
  renderStatistics();
  renderDataset();
  renderFilters();
  renderResults();
  renderRoomHistory();
  renderCheckList('#invariantList', state.invariants, 'Chưa chạy thuật toán.');
  renderLog();
}

/* ---- Handlers ------------------------------------------------------------ */
function handleRun() {
  const ds = currentDataset();
  if (DEBUG) console.clear();
  state.result = runAllocation(ds.classes, ds.rooms);
  state.invariants = checkInvariants(state.result, ds.rooms, ds.classes);
  if (DEBUG) console.table(state.result.classes.map((c) => ({
    id: c.id, lop: c.className, hocPhan: c.course, thu: c.day, tiet: periodLabel(c),
    sv: c.studentCount, phong: c.assignedRoom ?? '--', trangThai: c.status,
  })));
  renderAll();
}

function handleReset() {
  state.result = null;
  state.invariants = null;
  state.dayFilter = 'all';
  state.statusFilter = 'all';
  $('#resultEmpty').textContent = 'Chưa chạy thuật toán. Nhấn "Chạy thuật toán" để bắt đầu.';
  renderAll();
}

function handleTest() {
  const results = runTestCases();
  renderCheckList('#testList', results);
  if (DEBUG) console.table(results);
}

/* ============================================================================
 * 7. KHỞI TẠO
 * ========================================================================== */
function init() {
  const select = $('#datasetSelect');
  select.innerHTML = Object.values(DATASETS).map((d) =>
    `<option value="${d.key}" ${d.key === state.datasetKey ? 'selected' : ''}>${esc(d.label)}</option>`).join('');
  select.addEventListener('change', () => { state.datasetKey = select.value; handleReset(); });

  $('#debugToggle').addEventListener('change', (e) => { DEBUG = e.target.checked; });
  $('#runBtn').addEventListener('click', handleRun);
  $('#resetBtn').addEventListener('click', handleReset);
  $('#testBtn').addEventListener('click', handleTest);

  $('#dayFilter').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-day]');
    if (!btn) return;
    state.dayFilter = btn.dataset.day;
    renderFilters(); renderResults(); renderRoomHistory();
  });
  $('#statusFilter').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-status]');
    if (!btn) return;
    state.statusFilter = btn.dataset.status;
    renderFilters(); renderResults();
  });

  renderAll();
}

document.addEventListener('DOMContentLoaded', init);

// Cho phép gọi tay trong console: window.RoomAllocation.runAllocation(classes, rooms)
window.RoomAllocation = {
  runAllocation, sortClasses, isRoomSuitable, isRoomOccupied, isTimeConflict,
  findAvailableRooms, selectBestRoom, findMergeCandidate, checkInvariants, runTestCases, DATASETS,
};
