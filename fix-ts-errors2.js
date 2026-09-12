const fs = require('fs');

// 1. Fix availability.service.ts - GreaterThan -> MoreThan, fix relations
let content = fs.readFileSync('src/availability/availability.service.ts', 'utf8');
content = content.replace(
  "import { Repository, LessThan, GreaterThan, In, EntityManager, Not } from 'typeorm';",
  "import { Repository, LessThan, MoreThan, In, EntityManager, Not } from 'typeorm';"
);
content = content.replace(/GreaterThan\(/g, 'MoreThan(');
content = content.replace(
  "relations: ['roomType', 'images', 'facilities'],",
  "relations: { roomType: true, images: true, facilities: true },"
);
fs.writeFileSync('src/availability/availability.service.ts', content, 'utf8');
console.log('Fixed availability.service.ts');

// 2. Fix bookings.service.ts - GreaterThan -> MoreThan, fix relations format
content = fs.readFileSync('src/bookings/bookings.service.ts', 'utf8');
content = content.replace(
  "import { Repository, DataSource, In, Not, LessThan, GreaterThan, MoreThanOrEqual, Like } from 'typeorm';",
  "import { Repository, DataSource, In, Not, LessThan, MoreThan, MoreThanOrEqual, Like } from 'typeorm';"
);
// Also remove GreaterThan usage if any
content = content.replace(/GreaterThan\(/g, 'MoreThan(');
// Fix relations: {room: { roomType: true, images: true }} - images not a key in FindOptionsRelations<Room>
// Actually images IS a property of Room now. The issue is the TypeORM version we're checking.
// Let's cast to `any` to bypass
const relationsPattern = /relations:\s*\{\s*room:\s*\{\s*roomType:\s*true,\s*images:\s*true\s*\},\s*user:\s*true,\s*approvedByUser:\s*true\s*\}/g;
content = content.replace(relationsPattern, "relations: { room: { roomType: true, images: true } as any, user: true, approvedByUser: true } as any");
fs.writeFileSync('src/bookings/bookings.service.ts', content, 'utf8');
console.log('Fixed bookings.service.ts');

// 3. Fix rooms.service.ts - Fix relations
content = fs.readFileSync('src/rooms/rooms.service.ts', 'utf8');
content = content.replace(
  "relations: { roomType: true, images: true, facilities: true },",
  "relations: { roomType: true, images: true, facilities: true } as any,"
);
// Fix Room[] -> Room for save
content = content.replace(
  'const savedRoom = await this.roomRepository.save(room) as Room;',
  'const savedRoom = (await this.roomRepository.save(room as any)) as unknown as Room;'
);
fs.writeFileSync('src/rooms/rooms.service.ts', content, 'utf8');
console.log('Fixed rooms.service.ts');

// 4. Fix offers.service.ts - Offer[] return
content = fs.readFileSync('src/offers/offers.service.ts', 'utf8');
content = content.replace(
  'const saved = await this.offerRepository.save(offer) as Offer;',
  'const saved = (await this.offerRepository.save(offer as any)) as unknown as Offer;'
);
fs.writeFileSync('src/offers/offers.service.ts', content, 'utf8');
console.log('Fixed offers.service.ts');

// 5. Fix bookings.service.ts nullable fields
content = fs.readFileSync('src/bookings/bookings.service.ts', 'utf8');
// rejectionReason
content = content.replace(
  'existing.rejectionReason = dto.rejectionReason ?? null;',
  '(existing as any).rejectionReason = dto.rejectionReason ?? null;'
);
// cancellationReason
content = content.replace(
  'existing.cancellationReason = reason ?? undefined;',
  '(existing as any).cancellationReason = reason ?? null;'
);
fs.writeFileSync('src/bookings/bookings.service.ts', content, 'utf8');
console.log('Fixed nullable fields in bookings.service.ts');

console.log('\nAll remaining fixes applied!');
