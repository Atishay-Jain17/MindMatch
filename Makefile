CXX      := g++
CXXFLAGS := -std=c++17 -Wall -Wextra -O2 -Iinclude
TARGET   := mindmatch
SRCDIR   := src
BUILDDIR := build

SRCS := $(wildcard $(SRCDIR)/*.cpp)
OBJS := $(patsubst $(SRCDIR)/%.cpp,$(BUILDDIR)/%.o,$(SRCS))

.PHONY: all clean run demo generate

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CXX) $(CXXFLAGS) -o $@ $^
	@echo "\n✓ Build complete → ./$(TARGET)"

$(BUILDDIR)/%.o: $(SRCDIR)/%.cpp | $(BUILDDIR)
	$(CXX) $(CXXFLAGS) -c -o $@ $<

$(BUILDDIR):
	mkdir -p $(BUILDDIR)

# Run with built-in demo dataset
run: $(TARGET)
	./$(TARGET)

# Generate a 50-user sample and run
demo: $(TARGET)
	./$(TARGET) --generate 50
	./$(TARGET) data/generated.csv 0.30

# Export JSON result for UI
json: $(TARGET)
	./$(TARGET) --json data/generated.csv 0.30 > ui/result.json
	@echo "→ ui/result.json written"

clean:
	rm -rf $(BUILDDIR) $(TARGET)
