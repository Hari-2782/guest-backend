import { DataSource } from 'typeorm';
import { Room } from './src/rooms/entities/room.entity';
import { Facility } from './src/facilities/entities/facility.entity';
import { User } from './src/users/entities/user.entity';
import { RoomType } from './src/room-types/entities/room-type.entity';
import { Offer } from './src/offers/entities/offer.entity';
import { Booking } from './src/bookings/entities/booking.entity';
import { BookingStatusHistory } from './src/bookings/entities/booking-status-history.entity';
import { RoomImage } from './src/rooms/entities/room-image.entity';
import { RefreshToken } from './src/auth/entities/refresh-token.entity';

async function test() {
  const ds = new DataSource({
    type: 'mysql',
    url: 'mysql://root:password@localhost:3306/dummy',
    entities: [Room, Facility, User, RoomType, Offer, Booking, BookingStatusHistory, RoomImage, RefreshToken],
    synchronize: false,
    logging: true,
  });

  const sqls = await ds.driver.createSchemaBuilder().log();
  console.log(sqls);
}
test().catch(console.error);
