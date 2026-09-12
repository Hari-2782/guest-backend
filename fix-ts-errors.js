const fs = require('fs');
const path = require('path');

// 1. Fix RoomStatus - add INACTIVE alias (same value as OCCUPIED or separate)
// Looking at the schema: Room status can be AVAILABLE | MAINTENANCE | OCCUPIED | INACTIVE
// Let's add INACTIVE to the entity enum

const roomEntityPath = 'src/rooms/entities/room.entity.ts';
let content = fs.readFileSync(roomEntityPath, 'utf8');
if (!content.includes('INACTIVE')) {
  content = content.replace(
    `export enum RoomStatus {\n  AVAILABLE = 'AVAILABLE',\n  MAINTENANCE = 'MAINTENANCE',\n  OCCUPIED = 'OCCUPIED',\n}`,
    `export enum RoomStatus {\n  AVAILABLE = 'AVAILABLE',\n  MAINTENANCE = 'MAINTENANCE',\n  OCCUPIED = 'OCCUPIED',\n  INACTIVE = 'INACTIVE',\n}`
  );
  fs.writeFileSync(roomEntityPath, content, 'utf8');
  console.log('Added INACTIVE to RoomStatus enum');
}

// 2. Fix relations - TypeORM newer versions want { relation: { nested: true } } format
// but older ones accept arrays. Let's use object format everywhere.
function fixRelations(filePath) {
  let c = fs.readFileSync(filePath, 'utf8');
  let orig = c;
  
  // Fix pattern: relations: ['room', 'room.roomType', 'room.images', 'user', 'approvedByUser']
  c = c.replace(/relations:\s*\['room',\s*'room\.roomType',\s*'room\.images',\s*'user',\s*'approvedByUser'\]/g, 
    `relations: { room: { roomType: true, images: true }, user: true, approvedByUser: true }`);

  // Fix pattern: relations: ['roomType', 'images', 'facilities']
  c = c.replace(/relations:\s*\['roomType',\s*'images',\s*'facilities'\]/g,
    `relations: { roomType: true, images: true, facilities: true }`);

  // Fix pattern: relations: ['rooms']
  c = c.replace(/relations:\s*\['rooms'\]/g, `relations: { rooms: true }`);

  // Fix pattern: relations: ['room', 'room.roomType', 'room.images']
  c = c.replace(/relations:\s*\['room',\s*'room\.roomType',\s*'room\.images'\]/g,
    `relations: { room: { roomType: true, images: true } }`);

  // Fix: relations: ['roomType', 'images', 'facilities'] with any quotes
  c = c.replace(/relations:\s*\["room",\s*"room\.roomType",\s*"room\.images",\s*"user",\s*"approvedByUser"\]/g, 
    `relations: { room: { roomType: true, images: true }, user: true, approvedByUser: true }`);

  if (c !== orig) {
    fs.writeFileSync(filePath, c, 'utf8');
    console.log('Fixed relations in', filePath);
  }
}

// Files that need relations fixed
const filesToFix = [
  'src/rooms/rooms.service.ts',
  'src/bookings/bookings.service.ts',
  'src/room-types/room-types.service.ts',
];

filesToFix.forEach(fixRelations);

// 3. Fix GreaterThanOrEqual -> MoreThanOrEqual in bookings.service.ts
let bookingsSvc = fs.readFileSync('src/bookings/bookings.service.ts', 'utf8');
let bookingsOrig = bookingsSvc;
bookingsSvc = bookingsSvc.replace(/GreaterThanOrEqual/g, 'MoreThanOrEqual');
bookingsSvc = bookingsSvc.replace(/import \{ Repository, DataSource, LessThanOrEqual, MoreThanOrEqual, Like \} from 'typeorm';/g,
  "import { Repository, DataSource, In, Not, LessThan, GreaterThan, MoreThanOrEqual, Like } from 'typeorm';");
if (bookingsSvc !== bookingsOrig) {
  fs.writeFileSync('src/bookings/bookings.service.ts', bookingsSvc, 'utf8');
  console.log('Fixed GreaterThanOrEqual in bookings.service.ts');
}

// 4. Fix rooms.service.ts sort callbacks (implicit any)
let roomsSvc = fs.readFileSync('src/rooms/rooms.service.ts', 'utf8');
let roomsOrig = roomsSvc;
roomsSvc = roomsSvc.replace(/\.sort\(\(a, b\) => a\.sortOrder - b\.sortOrder\)/g,
  '.sort((a: any, b: any) => a.sortOrder - b.sortOrder)');
if (roomsSvc !== roomsOrig) {
  fs.writeFileSync('src/rooms/rooms.service.ts', roomsSvc, 'utf8');
  console.log('Fixed sort callbacks in rooms.service.ts');
}

// 5. Fix savedRoom.id - save() returns the entity itself not array
roomsSvc = fs.readFileSync('src/rooms/rooms.service.ts', 'utf8');
roomsOrig = roomsSvc;
// save() returns a single entity when you pass a single entity, no issue
// But if it returns Room[] then savedRoom.id won't work. Let's cast.
roomsSvc = roomsSvc.replace(/const savedRoom = await this\.roomRepository\.save\(room\);/,
  'const savedRoom = await this.roomRepository.save(room) as Room;');
if (roomsSvc !== roomsOrig) {
  fs.writeFileSync('src/rooms/rooms.service.ts', roomsSvc, 'utf8');
  console.log('Fixed savedRoom type in rooms.service.ts');
}

// 6. Fix bookings.service.ts rejectionReason (string | undefined vs string)
bookingsSvc = fs.readFileSync('src/bookings/bookings.service.ts', 'utf8');
bookingsOrig = bookingsSvc;
bookingsSvc = bookingsSvc.replace(
  'existing.rejectionReason = dto.rejectionReason;',
  'existing.rejectionReason = dto.rejectionReason ?? null;'
);
bookingsSvc = bookingsSvc.replace(
  "existing.cancellationReason = reason ?? null;",
  "existing.cancellationReason = reason ?? undefined;"
);
if (bookingsSvc !== bookingsOrig) {
  fs.writeFileSync('src/bookings/bookings.service.ts', bookingsSvc, 'utf8');
  console.log('Fixed nullable fields in bookings.service.ts');
}

// 7. Fix offers.service.ts - offerRepository.save() can return Offer[] if input is array
// We called this.offerRepository.save(offer) - single entity input returns single entity
// But TypeScript types it as Offer | Offer[]. Need to cast.
let offersSvc = fs.readFileSync('src/offers/offers.service.ts', 'utf8');
let offersOrig = offersSvc;
offersSvc = offersSvc.replace(
  'const saved = await this.offerRepository.save(offer);\n    return mapOfferToResponse(saved);',
  'const saved = await this.offerRepository.save(offer) as Offer;\n    return mapOfferToResponse(saved);'
);
if (offersSvc !== offersOrig) {
  fs.writeFileSync('src/offers/offers.service.ts', offersSvc, 'utf8');
  console.log('Fixed save() return type in offers.service.ts');
}

// 8. Fix select in availability.service.ts - ['roomId'] should be object
let availSvc = fs.readFileSync('src/availability/availability.service.ts', 'utf8');
let availOrig = availSvc;
availSvc = availSvc.replace(
  `select: ['roomId'],`,
  `select: { roomId: true },`
);
if (availSvc !== availOrig) {
  fs.writeFileSync('src/availability/availability.service.ts', availSvc, 'utf8');
  console.log('Fixed select in availability.service.ts');
}

// 9. Fix bookings.service.ts - import generateBookingNumber with EntityManager
bookingsSvc = fs.readFileSync('src/bookings/bookings.service.ts', 'utf8');
bookingsOrig = bookingsSvc;
// Update the call to generateBookingNumber to pass manager instead of tx
bookingsSvc = bookingsSvc.replace(
  "const bookingNumber = 'BN' + Date.now(); // TODO: generate properly without prisma",
  "const bookingNumber = await generateBookingNumber(manager);"
);
// Add the import if not present
if (!bookingsSvc.includes('generateBookingNumber')) {
  // already imported - let's just check
}
if (bookingsSvc !== bookingsOrig) {
  fs.writeFileSync('src/bookings/bookings.service.ts', bookingsSvc, 'utf8');
  console.log('Fixed generateBookingNumber call in bookings.service.ts');
}

console.log('\nAll fixes applied!');
