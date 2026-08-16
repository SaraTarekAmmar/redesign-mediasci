"""Create and seed the local Redesign MediaSci SQLite database."""

from app.database import Base, engine
import app.models  # noqa: F401 - register every model with SQLAlchemy metadata
from seed_operation_hub_demo import seed_demo_data


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    seed_demo_data()
    print("Local Redesign MediaSci database created and seeded.")

