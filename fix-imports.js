const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = glob.sync('src/**/*.ts', { cwd: process.cwd() });
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  if (content.includes('@prisma/client')) {
    // Determine relative paths
    const userEntityPath = path.relative(path.dirname(file), 'src/users/entities/user.entity').replace(/\\/g, '/');
    const roomEntityPath = path.relative(path.dirname(file), 'src/rooms/entities/room.entity').replace(/\\/g, '/');
    const bookingEntityPath = path.relative(path.dirname(file), 'src/bookings/entities/booking.entity').replace(/\\/g, '/');
    const offerEntityPath = path.relative(path.dirname(file), 'src/offers/entities/offer.entity').replace(/\\/g, '/');
    
    const formatPath = (p) => p.startsWith('.') ? p : './' + p;

    content = content.replace(/import\s+\{\s*Role\s*\}\s+from\s+'@prisma\/client';/g, `import { Role } from '${formatPath(userEntityPath)}';`);
    content = content.replace(/import\s+\{\s*Role\s*,\s*UserStatus\s*\}\s+from\s+'@prisma\/client';/g, `import { Role, UserStatus } from '${formatPath(userEntityPath)}';`);
    content = content.replace(/import\s+\{\s*UserStatus\s*\}\s+from\s+'@prisma\/client';/g, `import { UserStatus } from '${formatPath(userEntityPath)}';`);
    
    content = content.replace(/import\s+\{\s*RoomStatus\s*\}\s+from\s+'@prisma\/client';/g, `import { RoomStatus } from '${formatPath(roomEntityPath)}';`);
    
    content = content.replace(/import\s+\{\s*BookingStatus\s*\}\s+from\s+'@prisma\/client';/g, `import { BookingStatus } from '${formatPath(bookingEntityPath)}';`);
    content = content.replace(/import\s+\{\s*BookingStatus\s*,\s*Role\s*\}\s+from\s+'@prisma\/client';/g, `import { BookingStatus } from '${formatPath(bookingEntityPath)}';\nimport { Role } from '${formatPath(userEntityPath)}';`);
    content = content.replace(/import\s+\{\s*BookingStatus\s*,\s*Role\s*,\s*RoomStatus\s*\}\s+from\s+'@prisma\/client';/g, `import { BookingStatus } from '${formatPath(bookingEntityPath)}';\nimport { Role } from '${formatPath(userEntityPath)}';\nimport { RoomStatus } from '${formatPath(roomEntityPath)}';`);
    content = content.replace(/import\s+\{\s*BookingStatus\s*,\s*RoomStatus\s*\}\s+from\s+'@prisma\/client';/g, `import { BookingStatus } from '${formatPath(bookingEntityPath)}';\nimport { RoomStatus } from '${formatPath(roomEntityPath)}';`);
    
    content = content.replace(/import\s+\{\s*DiscountType\s*\}\s+from\s+'@prisma\/client';/g, `import { DiscountType } from '${formatPath(offerEntityPath)}';`);
    
    content = content.replace(/import\s+\{\s*Prisma\s*\}\s+from\s+'@prisma\/client';/g, `// removed prisma import`);
    
    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      console.log('Fixed imports in', file);
    }
  }
}
